/**
 * Contas, pagamentos e gastos avulsos de exemplo para desenvolvimento LOCAL.
 * Pré-requisito: ter feito login uma vez com o ALLOWED_EMAIL (o usuário do
 * Google só existe depois do primeiro login).
 *
 *   pnpm seed:dev           # cria os dados de exemplo
 *   pnpm seed:dev --reset   # apaga os lançamentos e as contas do usuário antes
 */
import { createClient } from "@supabase/supabase-js";
import { addDays, daysInMonth, formatPlainDate, parsePlainDate, todayInSaoPaulo } from "../src/lib/recurrence";
import type { Database } from "../src/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["category"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

if (!url || !secretKey || !email) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e ALLOWED_EMAIL no .env.local.");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Recusado: o seed só roda contra o Supabase local (URL atual: ${url}).`);
  process.exit(1);
}

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false } });

async function findUserId(): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 200) break;
  }
  console.error(`Usuário ${email} não encontrado. Faça login no app uma vez e rode de novo.`);
  process.exit(1);
}

const today = todayInSaoPaulo();
const { year, month } = parsePlainDate(today);
/** Dia `day` (limitado ao fim do mês) do mês corrente + `offset` meses. */
const monthDay = (day: number, offset = 0) => {
  const index = month - 1 + offset;
  const y = year + Math.floor(index / 12);
  const m = (((index % 12) + 12) % 12) + 1;
  return formatPlainDate({ year: y, month: m, day: Math.min(day, daysInMonth(y, m)) });
};
/** Último mês com 31 dias, entre 2 e 6 meses atrás — âncora para testar o ajuste de fim de mês. */
const day31 = [-2, -3, -4, -5, -6].map((o) => monthDay(31, o)).find((d) => d.endsWith("-31"))!;

async function main() {
  const userId = await findUserId();

  if (process.argv.includes("--reset")) {
    // Primeiro os lançamentos: os avulsos não caem por cascade ao apagar as contas.
    const { error: txError } = await supabase.from("transactions").delete().eq("user_id", userId);
    if (txError) throw txError;
    const { error } = await supabase.from("bills").delete().eq("user_id", userId);
    if (error) throw error;
  }

  const bills: Database["public"]["Tables"]["bills"]["Insert"][] = [
    { name: "Aluguel", category: "moradia", frequency: "monthly", start_date: monthDay(5, -3), estimated_amount_cents: 250000 },
    { name: "Conta de luz", category: "consumo", frequency: "monthly", start_date: day31, estimated_amount_cents: 18990 },
    { name: "Internet", category: "internet", frequency: "monthly", start_date: today, estimated_amount_cents: 11990 },
    { name: "Diarista", category: "casa", frequency: "weekly", start_date: addDays(today, -12), estimated_amount_cents: 18000 },
    { name: "IPTU", category: "impostos", frequency: "yearly", start_date: addDays(today, 3), notes: "Pagar em cota única para ter desconto." },
    { name: "Revisão do ar-condicionado", category: "casa", frequency: "once", start_date: addDays(today, 6) },
  ];

  const { data, error } = await supabase
    .from("bills")
    .insert(bills.map((b) => ({ ...b, user_id: userId })))
    .select("id, name, category, start_date");
  if (error) throw error;

  // Alguns pagamentos para popular o histórico. Como no app, o lançamento leva o nome e a categoria da conta.
  const byName = Object.fromEntries(data.map((b) => [b.name, b]));
  const payment = (billName: string, dueDate: string, paidAt: string, amountCents: number) => {
    const bill = byName[billName];
    return {
      user_id: userId,
      bill_id: bill.id,
      due_date: dueDate,
      paid_at: paidAt,
      amount_cents: amountCents,
      description: bill.name,
      category: bill.category,
    };
  };
  const payments = [
    payment("Aluguel", monthDay(5, -3), monthDay(4, -3), 250000),
    payment("Aluguel", monthDay(5, -2), monthDay(5, -2), 250000),
    payment("Aluguel", monthDay(5, -1), monthDay(6, -1), 250000),
    payment("Diarista", addDays(today, -12), addDays(today, -12), 18000),
  ];

  // Gastos avulsos (sem conta), sempre no passado: alguns neste mês, outros em meses anteriores.
  const oneOff = (daysAgo: number, description: string, category: Category, amountCents: number) => ({
    user_id: userId,
    paid_at: addDays(today, -daysAgo),
    description,
    category,
    amount_cents: amountCents,
  });
  const oneOffs = [
    oneOff(1, "Mercado", "alimentacao", 34250),
    oneOff(6, "Farmácia", "saude", 8790),
    oneOff(24, "Ingresso do show", "lazer", 18000),
    oneOff(38, "Presente de aniversário", "compras", 15000),
    oneOff(65, "Mercado", "alimentacao", 41230),
  ];

  const { error: txError } = await supabase.from("transactions").insert([...payments, ...oneOffs]);
  if (txError) throw txError;

  console.log(
    `Criadas ${data.length} contas, ${payments.length} pagamentos e ${oneOffs.length} gastos avulsos de exemplo para ${email}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
