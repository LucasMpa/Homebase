-- Gastos de terceiros deixam de registrar o cartão usado na compra.
alter table public.third_party_expenses drop column card;
