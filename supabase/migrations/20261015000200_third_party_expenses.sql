-- Gastos de terceiros no cartão: compras que outra pessoa passou no seu cartão
-- e que ela precisa te devolver. settled_at = dia em que o valor foi acertado.

create table public.third_party_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  person text not null check (length(trim(person)) > 0),
  description text not null check (length(trim(description)) > 0),
  amount_cents integer not null check (amount_cents > 0),
  purchase_date date not null,
  -- Só informativo: o valor guardado é sempre o total da compra.
  installments smallint not null default 1 check (installments between 1 and 48),
  card text,
  notes text,
  settled_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index third_party_expenses_pending_idx on public.third_party_expenses (user_id) where settled_at is null;

create trigger third_party_expenses_set_updated_at
  before update on public.third_party_expenses
  for each row execute function public.set_updated_at();

alter table public.third_party_expenses enable row level security;

create policy "own third party expenses" on public.third_party_expenses
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

revoke all on table public.third_party_expenses from anon;
grant select, insert, update, delete on table public.third_party_expenses to authenticated;
grant select, insert, update, delete on table public.third_party_expenses to service_role;
