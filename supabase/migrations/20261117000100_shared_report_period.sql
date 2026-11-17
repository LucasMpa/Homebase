-- get_shared_report passa a devolver só o que o resumo do link mostra:
--   * apenas gastos com alguma parcela dentro do período do link (antes vinha
--     todo o histórico da pessoa, acessível chamando a RPC direto);
--   * sem o id real do gasto (um índice no lugar);
--   * as parcelas pendentes de antes do período vêm só agregadas (valor,
--     quantidade e o mês mais antigo), sem descrição nem gasto.
--
-- O cálculo das parcelas repete a regra de installmentSchedule() em
-- src/lib/third-party.ts: a 1ª parcela cai no mês da compra e leva a sobra dos centavos.

create or replace function public.get_shared_report(share_token text)
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
  earlier jsonb;
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

  -- Gastos com ao menos uma parcela no período: [mês da compra, último mês] ∩ [from, to].
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.ord::text,
      'person', p.person,
      'description', p.description,
      'amountCents', p.amount_cents,
      'purchaseDate', p.purchase_date,
      'installments', p.installments,
      'settlements', p.settlements
    ) order by p.ord
  ), '[]'::jsonb)
  into expenses
  from (
    select
      row_number() over (order by e.purchase_date desc, e.description, e.id) as ord,
      e.person,
      e.description,
      e.amount_cents,
      e.purchase_date,
      e.installments,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'installment', t.installment,
          'amountCents', t.amount_cents,
          'settledAt', t.settled_at
        ) order by t.installment)
        from public.third_party_settlements t
        where t.expense_id = e.id and t.user_id = s.user_id
      ), '[]'::jsonb) as settlements
    from public.third_party_expenses e
    where e.user_id = s.user_id
      and private.person_key(e.person) = private.person_key(s.person)
      and to_char(e.purchase_date, 'YYYY-MM') <= s.to_month
      and to_char(date_trunc('month', e.purchase_date) + make_interval(months => e.installments - 1), 'YYYY-MM')
          >= s.from_month
  ) p;

  -- Parcelas pendentes que vencem antes do período, de qualquer gasto da pessoa.
  select jsonb_build_object(
    'cents', coalesce(sum(
      case when g.n = 1
        then e.amount_cents - (e.amount_cents / e.installments) * (e.installments - 1)
        else e.amount_cents / e.installments
      end
    ), 0),
    'count', count(*),
    'firstMonth', min(to_char(date_trunc('month', e.purchase_date) + make_interval(months => g.n - 1), 'YYYY-MM'))
  )
  into earlier
  from public.third_party_expenses e
  cross join lateral generate_series(1, e.installments) as g(n)
  where e.user_id = s.user_id
    and private.person_key(e.person) = private.person_key(s.person)
    and to_char(date_trunc('month', e.purchase_date) + make_interval(months => g.n - 1), 'YYYY-MM') < s.from_month
    and not exists (
      select 1 from public.third_party_settlements t
      where t.expense_id = e.id and t.user_id = s.user_id and t.installment = g.n
    );

  return jsonb_build_object(
    'person', s.person,
    'fromMonth', s.from_month,
    'toMonth', s.to_month,
    'expiresAt', s.expires_at,
    'expenses', expenses,
    'earlier', earlier
  );
end;
$$;

revoke execute on function public.get_shared_report(text) from public;
grant execute on function public.get_shared_report(text) to anon, authenticated, service_role;
