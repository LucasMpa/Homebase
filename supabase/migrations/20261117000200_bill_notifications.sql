-- Avisos de vencimento por e-mail (resumo diário).
--
-- bill_notifications registra cada aviso enviado: conta, vencimento, tipo e dia
-- do envio. É o que impede avisos repetidos (o job pode rodar mais de uma vez)
-- e conta o intervalo semanal dos avisos de atraso. A regra de quais avisos
-- saem fica em src/features/bills/lib/reminders.ts.
--
-- O job diário roda sem sessão de usuário. Em vez de dar a ele a chave
-- service_role, ele chama duas funções security definer que exigem o
-- CRON_SECRET: o banco guarda só o SHA-256 dele (private.app_settings), gravado
-- por set_cron_secret_hash() com a service_role (pnpm sync:cron-secret).

create table public.bill_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  bill_id uuid not null,
  due_date date not null,
  kind text not null check (kind in ('due_in_7', 'due_in_3', 'due_in_1', 'due_today', 'overdue')),
  sent_on date not null,
  created_at timestamptz not null default now(),
  -- Atraso pode ter vários avisos (um por semana), mas no máximo um por dia.
  unique (bill_id, due_date, kind, sent_on),
  foreign key (bill_id, user_id) references public.bills (id, user_id) on delete cascade
);

-- Avisos de vencimento (7, 3, 1 dia e no dia) saem uma vez só por parcela.
create unique index bill_notifications_once_idx
  on public.bill_notifications (bill_id, due_date, kind)
  where kind <> 'overdue';

create index bill_notifications_user_due_idx on public.bill_notifications (user_id, due_date);

alter table public.bill_notifications enable row level security;

-- O usuário só lê (para uma futura tela de histórico); quem grava é o job.
create policy "own bill notifications" on public.bill_notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()));

revoke all on table public.bill_notifications from anon, authenticated;
grant select on table public.bill_notifications to authenticated;
grant select, insert, update, delete on table public.bill_notifications to service_role;

-- Segredo do job ------------------------------------------------------------

create function public.set_cron_secret_hash(secret_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if secret_hash is null or secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'secret_hash deve ser o SHA-256 em hexadecimal';
  end if;
  insert into private.app_settings (key, value)
  values ('cron_secret_hash', secret_hash)
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke execute on function public.set_cron_secret_hash(text) from public, anon, authenticated;
grant execute on function public.set_cron_secret_hash(text) to service_role;

/** Id do usuário permitido se `job_secret` confere com o hash guardado; senão null. */
create function private.job_user_id(job_secret text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected text;
  allowed text;
  uid uuid;
begin
  if job_secret is null or length(job_secret) < 32 or length(job_secret) > 256 then
    return null;
  end if;
  select value into expected from private.app_settings where key = 'cron_secret_hash';
  if expected is null or encode(sha256(convert_to(job_secret, 'UTF8')), 'hex') <> expected then
    return null;
  end if;
  select value into allowed from private.app_settings where key = 'allowed_email';
  if allowed is null then
    return null;
  end if;
  select id into uid from auth.users where lower(email) = allowed;
  return uid;
end;
$$;
revoke execute on function private.job_user_id(text) from public, anon, authenticated;

-- Leitura do job ------------------------------------------------------------

/**
 * Dados para decidir os avisos de vencimentos em [from_date, to_date]: contas
 * ativas, pagamentos e avisos já enviados do usuário permitido, e o e-mail dele.
 * Segredo errado (ou sem configuração) → null, sem distinguir o motivo.
 */
create function public.get_reminder_data(job_secret text, from_date date, to_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := private.job_user_id(job_secret);
  if uid is null or from_date is null or to_date is null or from_date > to_date
     or to_date - from_date > 120 then
    return null;
  end if;

  return jsonb_build_object(
    'email', (select value from private.app_settings where key = 'allowed_email'),
    'bills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'frequency', b.frequency,
        'startDate', b.start_date,
        'endDate', b.end_date,
        'estimatedAmountCents', b.estimated_amount_cents
      ) order by b.name)
      from public.bills b
      where b.user_id = uid and b.archived_at is null
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'billId', t.bill_id,
        'dueDate', t.due_date,
        'paidAt', t.paid_at,
        'amountCents', t.amount_cents
      ))
      from public.transactions t
      where t.user_id = uid and t.bill_id is not null and t.due_date between from_date and to_date
    ), '[]'::jsonb),
    'sent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'billId', n.bill_id,
        'dueDate', n.due_date,
        'kind', n.kind,
        'sentOn', n.sent_on
      ))
      from public.bill_notifications n
      where n.user_id = uid and n.due_date between from_date and to_date
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.get_reminder_data(text, date, date) from public;
grant execute on function public.get_reminder_data(text, date, date) to anon, authenticated, service_role;

-- Registro do job -----------------------------------------------------------

/**
 * Registra os avisos enviados: [{billId, dueDate, kind, sentOn}]. Ignora contas
 * de outro usuário e avisos já registrados. Devolve quantos foram gravados, ou
 * null se o segredo não confere.
 */
create function public.record_bill_notifications(job_secret text, items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  inserted integer;
begin
  uid := private.job_user_id(job_secret);
  if uid is null or items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then
    return null;
  end if;

  insert into public.bill_notifications (user_id, bill_id, due_date, kind, sent_on)
  select uid, x."billId", x."dueDate", x.kind, x."sentOn"
  from jsonb_to_recordset(items) as x("billId" uuid, "dueDate" date, kind text, "sentOn" date)
  where exists (select 1 from public.bills b where b.id = x."billId" and b.user_id = uid)
  on conflict do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke execute on function public.record_bill_notifications(text, jsonb) from public;
grant execute on function public.record_bill_notifications(text, jsonb) to anon, authenticated, service_role;
