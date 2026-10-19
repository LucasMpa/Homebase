-- Livro-caixa único: todo dinheiro que saiu é uma linha de public.transactions.
-- Pagamento de conta = lançamento com bill_id + due_date (a ocorrência paga).
-- Gasto avulso = lançamento sem conta.
-- Substitui public.bill_payments (o projeto ainda não tem dados reais).

-- Uma lista de categorias para contas e lançamentos.
alter type public.bill_category rename to category;
alter type public.category add value 'alimentacao' before 'casa';
alter type public.category add value 'lazer' before 'impostos';
alter type public.category add value 'compras' before 'impostos';
alter type public.category add value 'viagem' before 'impostos';

drop table public.bill_payments;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  -- Dia em que o dinheiro saiu.
  paid_at date not null,
  -- Em pagamentos de conta, nome e categoria da conta no momento do pagamento.
  description text not null check (length(trim(description)) > 0),
  amount_cents integer not null check (amount_cents >= 0),
  category public.category not null,
  notes text,
  bill_id uuid,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Conta e vencimento andam juntos: ou é pagamento de uma ocorrência, ou é avulso.
  check ((bill_id is null) = (due_date is null)),
  -- Gasto avulso de R$ 0 não faz sentido; pagamento de conta pode ser 0 (isenção).
  check (bill_id is not null or amount_cents > 0),
  unique (bill_id, due_date),
  -- Composta com user_id: impede um lançamento de apontar para conta de outro usuário.
  foreign key (bill_id, user_id) references public.bills (id, user_id) on delete cascade
);

create index transactions_paid_at_idx on public.transactions (user_id, paid_at);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

revoke all on table public.transactions from anon;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.transactions to service_role;
