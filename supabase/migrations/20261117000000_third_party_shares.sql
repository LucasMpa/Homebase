-- Links públicos de compartilhamento dos gastos de terceiros: um resumo mensal
-- das parcelas de UMA pessoa, num período, acessível sem login por quem tiver o link.
--
-- Guardamos só o hash SHA-256 do token (o token em si só existe na URL). A leitura
-- pública passa pela função get_shared_report(), que valida o token, a validade e a
-- revogação e devolve só os gastos daquela pessoa — sem observações (notes).
-- O papel anon continua sem acesso a nenhuma tabela.

create table public.third_party_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Nome como exibido; a comparação com os gastos ignora caixa e espaços extras.
  person text not null check (length(trim(person)) > 0 and length(person) <= 60),
  from_month text not null check (from_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  to_month text not null check (to_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_month <= to_month),
  check (expires_at > created_at)
);

create index third_party_shares_user_idx on public.third_party_shares (user_id, expires_at desc);

alter table public.third_party_shares enable row level security;

create policy "own third party shares" on public.third_party_shares
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

revoke all on table public.third_party_shares from anon;
grant select, insert, update, delete on table public.third_party_shares to authenticated;
grant select, insert, update, delete on table public.third_party_shares to service_role;

-- Mesma regra de personKey() em src/lib/third-party.ts: sem espaços nas pontas,
-- espaços internos colapsados e minúsculas.
create function private.person_key(person text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(person), '\s+', ' ', 'g'));
$$;

/**
 * Resumo público de um link. Devolve null se o token não existe, expirou, foi
 * revogado ou se o dono do link não é mais o e-mail permitido.
 */
create function public.get_shared_report(share_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.third_party_shares;
  allowed text;
  owner_email text;
  expenses jsonb;
begin
  -- Tokens gerados pelo app têm 43 caracteres (32 bytes em base64url).
  if share_token is null or share_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;

  select * into s
  from public.third_party_shares
  where token_hash = encode(sha256(convert_to(share_token, 'UTF8')), 'hex')
    and revoked_at is null
    and expires_at > now();
  if not found then
    return null;
  end if;

  select value into allowed from private.app_settings where key = 'allowed_email';
  select lower(email) into owner_email from auth.users where id = s.user_id;
  if allowed is null or owner_email is distinct from allowed then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'person', e.person,
      'description', e.description,
      'amountCents', e.amount_cents,
      'purchaseDate', e.purchase_date,
      'installments', e.installments,
      'settlements', coalesce((
        select jsonb_agg(jsonb_build_object(
          'installment', t.installment,
          'amountCents', t.amount_cents,
          'settledAt', t.settled_at
        ) order by t.installment)
        from public.third_party_settlements t
        where t.expense_id = e.id and t.user_id = s.user_id
      ), '[]'::jsonb)
    ) order by e.purchase_date desc, e.description
  ), '[]'::jsonb)
  into expenses
  from public.third_party_expenses e
  where e.user_id = s.user_id
    and private.person_key(e.person) = private.person_key(s.person);

  return jsonb_build_object(
    'person', s.person,
    'fromMonth', s.from_month,
    'toMonth', s.to_month,
    'expiresAt', s.expires_at,
    'expenses', expenses
  );
end;
$$;

revoke execute on function private.person_key(text) from public, anon, authenticated;
revoke execute on function public.get_shared_report(text) from public;
grant execute on function public.get_shared_report(text) to anon, authenticated, service_role;
