import "server-only";
import { requireUser } from "@/lib/auth";
import type { Category } from "@/lib/format";
import type { BillFrequency, PaymentRecord, PlainDate, SchedulableBill } from "@/lib/recurrence";
import type { Database } from "@/lib/supabase/database.types";

type BillRow = Database["public"]["Tables"]["bills"]["Row"];
type PaymentRow = Pick<Database["public"]["Tables"]["transactions"]["Row"], "id" | "bill_id" | "due_date" | "paid_at" | "amount_cents">;

export interface Bill extends SchedulableBill {
  name: string;
  category: Category;
  frequency: BillFrequency;
  startDate: PlainDate;
  endDate: PlainDate | null;
  notes: string | null;
  archivedAt: string | null;
}

export interface Payment extends PaymentRecord {
  id: string;
}

export function toBill(row: BillRow): Bill {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    estimatedAmountCents: row.estimated_amount_cents,
    notes: row.notes,
    archivedAt: row.archived_at,
    rule: {
      frequency: row.frequency,
      startDate: row.start_date,
      endDate: row.end_date,
      archived: row.archived_at !== null,
    },
  };
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    // Só lançamentos com conta chegam aqui (filtro em listPayments).
    billId: row.bill_id!,
    dueDate: row.due_date!,
    paidAt: row.paid_at,
    amountCents: row.amount_cents,
  };
}

// Toda leitura passa por requireUser(): sessão + ALLOWED_EMAIL no servidor, e RLS no banco.

export async function listBills({ archived }: { archived: boolean }): Promise<Bill[]> {
  const { supabase } = await requireUser();
  let query = supabase.from("bills").select("*").order("name");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toBill);
}

export async function getBill(id: string): Promise<Bill | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("bills").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toBill(data) : null;
}

/** Pagamentos de contas: os lançamentos que apontam para uma ocorrência. */
export async function listPayments(filter: { billId?: string } = {}): Promise<Payment[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("transactions")
    .select("id, bill_id, due_date, paid_at, amount_cents")
    .not("bill_id", "is", null)
    .order("due_date", { ascending: false });
  if (filter.billId) query = query.eq("bill_id", filter.billId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toPayment);
}
