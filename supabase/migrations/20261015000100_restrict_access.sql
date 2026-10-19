-- Restringe o acesso ao ALLOWED_EMAIL também dentro do Supabase, não só no Next.js.
-- Sem isso, qualquer conta Google poderia se cadastrar direto pela API do Auth
-- (/auth/v1/authorize) e gravar linhas próprias via /rest/v1 com a publishable key.
--
-- O e-mail permitido fica em private.app_settings e é sincronizado a partir do
-- .env.local por `pnpm sync:allowed-email` (roda automaticamente antes do `pnpm dev`).
-- Sem e-mail configurado, nada é permitido (falha fechada).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_settings (
  key text primary key,
  value text not null
);
revoke all on table private.app_settings from public, anon, authenticated;

-- Só a secret key (service_role) pode definir o e-mail permitido.
create function public.set_allowed_email(email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.app_settings (key, value)
  values ('allowed_email', lower(trim(email)))
  on conflict (key) do update set value = excluded.value;
$$;
revoke execute on function public.set_allowed_email(text) from public, anon, authenticated;
grant execute on function public.set_allowed_email(text) to service_role;

-- 1) Auth hook: rejeita a criação de qualquer usuário com outro e-mail.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  allowed text;
begin
  select value into allowed from private.app_settings where key = 'allowed_email';
  if allowed is null or lower(trim(event -> 'user' ->> 'email')) is distinct from allowed then
    return jsonb_build_object(
      'error', jsonb_build_object('message', 'Este e-mail não tem acesso ao Homebase.', 'http_code', 403)
    );
  end if;
  return '{}'::jsonb;
end;
$$;
grant usage on schema private to supabase_auth_admin;
grant select on table private.app_settings to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- 2) Defesa em profundidade no RLS: além de ser o dono, o JWT precisa ser do e-mail permitido.
create function private.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.app_settings
    where key = 'allowed_email' and value = lower(auth.jwt() ->> 'email')
  );
$$;
-- O schema private não é exposto pela Data API; authenticated só executa esta função.
grant usage on schema private to authenticated;
revoke execute on function private.is_allowed_user() from public, anon;
grant execute on function private.is_allowed_user() to authenticated;

drop policy "own bills" on public.bills;
drop policy "own payments" on public.bill_payments;

create policy "own bills" on public.bills
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

create policy "own payments" on public.bill_payments
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

-- 3) "Arquivar e criar nova" numa única transação (security invoker: RLS se aplica).
create function public.archive_and_replace_bill(
  old_bill_id uuid,
  p_name text,
  p_frequency public.bill_frequency,
  p_start_date date,
  p_category text default null,
  p_end_date date default null,
  p_estimated_amount_cents integer default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  update public.bills set archived_at = now() where id = old_bill_id and archived_at is null;
  if not found then
    raise exception 'Conta não encontrada ou já arquivada' using errcode = 'P0002';
  end if;

  insert into public.bills (name, category, frequency, start_date, end_date, estimated_amount_cents, notes)
  values (p_name, p_category, p_frequency, p_start_date, p_end_date, p_estimated_amount_cents, p_notes)
  returning id into new_id;

  return new_id;
end;
$$;
revoke execute on function public.archive_and_replace_bill(uuid, text, public.bill_frequency, date, text, date, integer, text)
  from public, anon;
grant execute on function public.archive_and_replace_bill(uuid, text, public.bill_frequency, date, text, date, integer, text)
  to authenticated;
