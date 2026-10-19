import "server-only";
import { requireUser } from "@/lib/auth";
import type { Category } from "@/lib/format";
import type { PlainDate } from "@/lib/recurrence";
import type { Database } from "@/lib/supabase/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/**
 * Um lançamento do livro-caixa: dinheiro que saiu.
 * Com `billId`/`dueDate`, é o pagamento daquela ocorrência da conta; sem, é um gasto avulso.
 */
export interface Transaction {
  id: string;
  paidAt: PlainDate;
  description: string;
  amountCents: number;
  category: Category;
  notes: string | null;
  billId: string | null;
  dueDate: PlainDate | null;
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    paidAt: row.paid_at,
    description: row.description,
    amountCents: row.amount_cents,
    category: row.category,
    notes: row.notes,
    billId: row.bill_id,
    dueDate: row.due_date,
  };
}

// Toda leitura passa por requireUser(): sessão + ALLOWED_EMAIL no servidor, e RLS no banco.

/** Lançamentos com `paidAt` em [from, to] (limites opcionais), do mais recente para o mais antigo. */
export async function listTransactions(filter: { from?: PlainDate; to?: PlainDate } = {}): Promise<Transaction[]> {
  const { supabase } = await requireUser();
  let query = supabase.from("transactions").select("*");
  if (filter.from) query = query.gte("paid_at", filter.from);
  if (filter.to) query = query.lte("paid_at", filter.to);
  const { data, error } = await query.order("paid_at", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toTransaction);
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toTransaction(data) : null;
}

/** Existe algum lançamento, em qualquer data? Leitura mínima (um id). */
export async function hasAnyTransaction(): Promise<boolean> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("transactions").select("id").limit(1);
  if (error) throw error;
  return data.length > 0;
}
