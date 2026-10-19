-- Homebase — Fase 1: contas (bills) e pagamentos (bill_payments).
-- Princípio: a conta guarda a REGRA de recorrência; ocorrências são calculadas
-- no app e só pagamentos viram registros.

create type public.bill_frequency as enum ('once', 'weekly', 'monthly', 'yearly');

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  frequency public.bill_frequency not null,
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  estimated_amount_cents integer check (estimated_amount_cents >= 0),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  bill_id uuid not null,
  due_date date not null,
  paid_at date not null,
  amount_cents integer not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (bill_id, due_date),
  -- Composta com user_id: impede um pagamento de apontar para conta de outro usuário.
  foreign key (bill_id, user_id) references public.bills (id, user_id) on delete cascade
);

create index bills_active_idx on public.bills (user_id) where archived_at is null;
create index bill_payments_paid_at_idx on public.bill_payments (user_id, paid_at);

-- updated_at automático
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;

-- (select auth.uid()) é avaliado uma vez por query, não por linha.
create policy "own bills" on public.bills
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own payments" on public.bill_payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Grants explícitos: tabelas novas não são expostas automaticamente à Data API.
-- Apenas usuários autenticados; anon não tem acesso algum.
revoke all on table public.bills, public.bill_payments from anon;
grant select, insert, update, delete on table public.bills, public.bill_payments to authenticated;
grant select, insert, update, delete on table public.bills, public.bill_payments to service_role;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
