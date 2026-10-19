-- Categorias fixas e obrigatórias para as contas, no lugar do texto livre.
-- Os rótulos exibidos ficam no app (CATEGORY_LABELS em src/lib/format.ts).

create type public.bill_category as enum (
  'moradia',
  'consumo',
  'internet',
  'assinaturas',
  'casa',
  'saude',
  'educacao',
  'transporte',
  'impostos',
  'seguros',
  'outros'
);

-- Converte o texto livre que já existir; o que não casar com nenhuma categoria vira "outros".
alter table public.bills
  alter column category type public.bill_category using (
    case lower(trim(category))
      when 'moradia' then 'moradia'
      when 'contas de consumo' then 'consumo'
      when 'consumo' then 'consumo'
      when 'internet e telefone' then 'internet'
      when 'internet' then 'internet'
      when 'serviços' then 'internet'
      when 'assinaturas' then 'assinaturas'
      when 'casa e manutenção' then 'casa'
      when 'casa' then 'casa'
      when 'saúde' then 'saude'
      when 'educação' then 'educacao'
      when 'transporte' then 'transporte'
      when 'impostos' then 'impostos'
      when 'seguros' then 'seguros'
      else 'outros'
    end
  )::public.bill_category,
  alter column category set not null;

-- "Arquivar e criar nova" passa a receber a categoria tipada e obrigatória.
drop function public.archive_and_replace_bill(uuid, text, public.bill_frequency, date, text, date, integer, text);

create function public.archive_and_replace_bill(
  old_bill_id uuid,
  p_name text,
  p_frequency public.bill_frequency,
  p_start_date date,
  p_category public.bill_category,
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
revoke execute on function public.archive_and_replace_bill(uuid, text, public.bill_frequency, date, public.bill_category, date, integer, text)
  from public, anon;
grant execute on function public.archive_and_replace_bill(uuid, text, public.bill_frequency, date, public.bill_category, date, integer, text)
  to authenticated;
