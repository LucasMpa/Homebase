import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { isSettled, settledOn, uniqueSuggestions, type ThirdPartyExpense } from "@/lib/third-party";

type ExpenseRow = Database["public"]["Tables"]["third_party_expenses"]["Row"] & {
  third_party_settlements: Pick<
    Database["public"]["Tables"]["third_party_settlements"]["Row"],
    "installment" | "amount_cents" | "settled_at"
  >[];
};

const EXPENSE_SELECT = "*, third_party_settlements(installment, amount_cents, settled_at)";

function toExpense(row: ExpenseRow): ThirdPartyExpense {
  return {
    id: row.id,
    person: row.person,
    description: row.description,
    amountCents: row.amount_cents,
    purchaseDate: row.purchase_date,
    installments: row.installments,
    notes: row.notes,
    settlements: row.third_party_settlements.map((s) => ({
      installment: s.installment,
      amountCents: s.amount_cents,
      settledAt: s.settled_at,
    })),
  };
}

// Toda leitura passa por requireUser(): sessão + ALLOWED_EMAIL no servidor, e RLS no banco.

/**
 * Gastos pendentes (alguma parcela sem acerto) ou acertados (todas acertadas).
 * O filtro é feito aqui porque "acertado" depende das parcelas; o volume é pequeno.
 * Sem filtro, devolve todos.
 */
export async function listExpenses({ settled }: { settled?: boolean } = {}): Promise<ThirdPartyExpense[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("third_party_expenses")
    .select(EXPENSE_SELECT)
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  const expenses = data.map(toExpense);
  if (settled === undefined) return expenses;
  if (!settled) return expenses.filter((e) => !isSettled(e));
  // Acertados: o acerto mais recente primeiro.
  return expenses.filter(isSettled).sort((a, b) => settledOn(b)!.localeCompare(settledOn(a)!));
}

export async function getExpense(id: string): Promise<ThirdPartyExpense | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("third_party_expenses").select(EXPENSE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toExpense(data) : null;
}

/** Pessoas já usadas, para o autocompletar do formulário. */
export async function listExpenseSuggestions(): Promise<{ people: string[] }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("third_party_expenses").select("person");
  if (error) throw error;
  return {
    people: uniqueSuggestions(data.map((r) => r.person)),
  };
}
