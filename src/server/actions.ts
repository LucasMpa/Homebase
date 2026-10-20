"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { occurrencesBetween } from "@/lib/recurrence";
import { BILL_FIELDS, billFormSchema, type BillFormValues, type BillInput } from "@/lib/validation/bills";
import { fieldErrorsOf, formDataToStrings, type FieldErrors } from "@/lib/validation/common";
import { paymentFormSchema, paymentKeySchema, type PaymentFormValues } from "@/lib/validation/payments";

/**
 * Todas as mutações do app. Cada action: requireUser() (sessão + ALLOWED_EMAIL)
 * → validação zod → Supabase com RLS. Nada aqui confia no cliente.
 */

export type BillFormState = {
  message?: string;
  fieldErrors?: FieldErrors;
  values?: BillFormValues;
};

export type ActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: FieldErrors };

const idSchema = z.uuid();

function toRow(input: BillInput) {
  return {
    name: input.name,
    category: input.category,
    frequency: input.frequency,
    start_date: input.startDate,
    end_date: input.endDate,
    estimated_amount_cents: input.estimatedAmount,
    notes: input.notes,
  };
}

function parseBillForm(formData: FormData) {
  const values = formDataToStrings(formData, BILL_FIELDS);
  return { values, parsed: billFormSchema.safeParse(values) };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createBill(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const { supabase } = await requireUser();
  const { values, parsed } = parseBillForm(formData);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  const { data, error } = await supabase.from("bills").insert(toRow(parsed.data)).select("id").single();
  if (error) return { values, message: "Não foi possível salvar a conta. Tente novamente." };

  revalidateAll();
  redirect(`/bills/${data.id}`);
}

/**
 * Edita a conta. Com `mode=replace`, arquiva a conta atual e cria uma nova com
 * os dados do formulário — alternativa oferecida quando a regra muda e já há pagamentos.
 */
export async function updateBill(billId: string, _prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(billId).success) return { message: "Conta inválida." };
  const { values, parsed } = parseBillForm(formData);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  if (formData.get("mode") === "replace") {
    // Arquiva a antiga e cria a nova numa única transação (função SQL).
    const row = toRow(parsed.data);
    const { data: newId, error } = await supabase.rpc("archive_and_replace_bill", {
      old_bill_id: billId,
      p_name: row.name,
      p_category: row.category,
      p_frequency: row.frequency,
      p_start_date: row.start_date,
      p_end_date: row.end_date ?? undefined,
      p_estimated_amount_cents: row.estimated_amount_cents ?? undefined,
      p_notes: row.notes ?? undefined,
    });
    if (error || !newId) return { values, message: "Não foi possível arquivar e criar a nova conta." };
    revalidateAll();
    redirect(`/bills/${newId}`);
  }

  // Contas arquivadas não são editáveis.
  const { error, count } = await supabase
    .from("bills")
    .update(toRow(parsed.data), { count: "exact" })
    .eq("id", billId)
    .is("archived_at", null);
  if (error || count !== 1) return { values, message: "Não foi possível salvar as alterações." };

  revalidateAll();
  redirect(`/bills/${billId}`);
}

export async function setBillArchived(billId: string, archived: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(billId).success) return { ok: false, message: "Conta inválida." };
  const { error, count } = await supabase
    .from("bills")
    .update({ archived_at: archived ? new Date().toISOString() : null }, { count: "exact" })
    .eq("id", billId);
  if (error || count !== 1) return { ok: false, message: "Não foi possível atualizar a conta." };
  revalidateAll();
  return { ok: true };
}

/** Exclui a conta; os lançamentos de pagamento dela saem junto (on delete cascade). Arquivar preserva. */
export async function deleteBill(billId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(billId).success) return { ok: false, message: "Conta inválida." };
  const { error, count } = await supabase.from("bills").delete({ count: "exact" }).eq("id", billId);
  if (error || count !== 1) return { ok: false, message: "Não foi possível excluir a conta." };
  revalidateAll();
  redirect("/bills");
}

export async function markPaid(values: PaymentFormValues): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = paymentFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: "Confira os campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const { billId, dueDate, paidAt, amount } = parsed.data;

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("name, category, frequency, start_date, end_date")
    .eq("id", billId)
    .is("archived_at", null) // conta arquivada não recebe novos pagamentos
    .maybeSingle();
  if (billError || !bill) return { ok: false, message: "Conta não encontrada." };

  // O vencimento precisa ser uma ocorrência real da regra atual da conta.
  const rule = { frequency: bill.frequency, startDate: bill.start_date, endDate: bill.end_date, archived: false };
  if (occurrencesBetween(rule, dueDate, dueDate).length !== 1) {
    return { ok: false, message: "Esse vencimento não pertence a esta conta." };
  }

  // O lançamento guarda o retrato da conta (nome e categoria) no momento do pagamento.
  const { error } = await supabase.from("transactions").insert({
    bill_id: billId,
    due_date: dueDate,
    paid_at: paidAt,
    amount_cents: amount,
    description: bill.name,
    category: bill.category,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Essa ocorrência já está paga." : "Não foi possível registrar o pagamento.",
    };
  }
  revalidateAll();
  return { ok: true };
}

export async function unmarkPaid(billId: string, dueDate: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = paymentKeySchema.safeParse({ billId, dueDate });
  if (!parsed.success) return { ok: false, message: "Pagamento inválido." };
  // Filtra por conta E vencimento: nunca alcança um gasto avulso.
  const { error, count } = await supabase
    .from("transactions")
    .delete({ count: "exact" })
    .eq("bill_id", parsed.data.billId)
    .eq("due_date", parsed.data.dueDate);
  if (error || count !== 1) return { ok: false, message: "Não foi possível desfazer o pagamento." };
  revalidateAll();
  return { ok: true };
}
