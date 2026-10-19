-- Acerto por parcela nos gastos de terceiros: cada parcela paga vira uma linha
-- com a data e o valor recebido. O gasto está acertado quando todas as
-- parcelas têm acerto; por isso settled_at deixa de existir.

-- Necessário para a FK composta abaixo.
alter table public.third_party_expenses add unique (id, user_id);

create table public.third_party_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  expense_id uuid not null,
  -- Número da parcela (1 = mês da compra).
  installment smallint not null check (installment >= 1),
  -- Valor da parcela no momento do acerto.
  amount_cents integer not null check (amount_cents >= 0),
  settled_at date not null,
  created_at timestamptz not null default now(),
  unique (expense_id, installment),
  -- Composta com user_id: impede acertar parcela de gasto de outro usuário.
  foreign key (expense_id, user_id) references public.third_party_expenses (id, user_id) on delete cascade
);

create index third_party_settlements_settled_at_idx on public.third_party_settlements (user_id, settled_at);

-- Gastos já acertados: todas as parcelas, com a mesma data. A sobra de centavos
-- vai para a 1ª parcela, como em installmentSchedule (src/lib/third-party.ts).
insert into public.third_party_settlements (user_id, expense_id, installment, amount_cents, settled_at)
select
  e.user_id,
  e.id,
  i,
  case when i = 1
    then e.amount_cents - (e.amount_cents / e.installments) * (e.installments - 1)
    else e.amount_cents / e.installments
  end,
  e.settled_at
from public.third_party_expenses e
cross join lateral generate_series(1, e.installments) as i
where e.settled_at is not null;

drop index public.third_party_expenses_pending_idx;
alter table public.third_party_expenses drop column settled_at;

alter table public.third_party_settlements enable row level security;

create policy "own third party settlements" on public.third_party_settlements
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (user_id = (select auth.uid()) and (select private.is_allowed_user()));

revoke all on table public.third_party_settlements from anon;
grant select, insert, update, delete on table public.third_party_settlements to authenticated;
grant select, insert, update, delete on table public.third_party_settlements to service_role;
