"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { editLockReason } from "@/lib/ledger";
import { monthOf } from "@/lib/months";
import { fieldErrorsOf, formDataToStrings, type FieldErrors } from "@/lib/validation/common";
import {
  TRANSACTION_FIELDS,
  transactionFormSchema,
  type TransactionFormValues,
  type TransactionInput,
} from "@/lib/validation/transactions";
import type { ActionResult } from "@/server/actions";

/**
 * Mutações dos gastos avulsos (lançamentos sem conta). Mesmo padrão de
 * src/server/actions.ts: requireUser() → validação zod → Supabase com RLS.
 * Pagamentos de conta só mudam pela conta (markPaid/unmarkPaid).
 */

export type TransactionFormState = {
  message?: string;
  fieldErrors?: FieldErrors;
  values?: TransactionFormValues;
};

const idSchema = z.uuid();

/** Só as colunas do formulário: bill_id, due_date e user_id nunca vêm do cliente. */
function toRow(input: TransactionInput) {
  return {
    description: input.description,
    amount_cents: input.amount,
    paid_at: input.paidAt,
    category: input.category,
    notes: input.notes,
  };
}

function parseTransactionForm(formData: FormData) {
  const values = formDataToStrings(formData, TRANSACTION_FIELDS);
  return { values, parsed: transactionFormSchema.safeParse(values) };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Volta para o mês do gasto; `aviso` vira o toast na tela de Lançamentos. */
const ledgerUrl = (paidAt: string, aviso: "registrado" | "atualizado" | "excluido") =>
  `/lancamentos?mes=${monthOf(paidAt)}&aviso=${aviso}`;

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Lê o lançamento e diz por que ele não pode ser alterado aqui (null = pode). */
async function lockReasonOf(supabase: Supabase, id: string): Promise<string | null> {
  const { data, error } = await supabase.from("transactions").select("bill_id").eq("id", id).maybeSingle();
  if (error || !data) return null; // inexistente: o update/delete abaixo não acha nada e devolve o erro genérico
  return editLockReason({ billId: data.bill_id });
}

export async function createTransaction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { supabase } = await requireUser();
  const { values, parsed } = parseTransactionForm(formData);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  const { error } = await supabase.from("transactions").insert(toRow(parsed.data));
  if (error) return { values, message: "Não foi possível salvar o gasto. Tente novamente." };

  revalidateAll();
  redirect(ledgerUrl(parsed.data.paidAt, "registrado"));
}

export async function updateTransaction(
  transactionId: string,
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(transactionId).success) return { message: "Gasto inválido." };
  const { values, parsed } = parseTransactionForm(formData);

  const locked = await lockReasonOf(supabase, transactionId);
  if (locked) return { values, message: locked };
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  // `.is("bill_id", null)` é a garantia final: mesmo sem a checagem acima, só alcança avulsos.
  const { data, error } = await supabase
    .from("transactions")
    .update(toRow(parsed.data))
    .eq("id", transactionId)
    .is("bill_id", null)
    .select("paid_at")
    .maybeSingle();
  if (error || !data) return { values, message: "Não foi possível salvar as alterações." };

  revalidateAll();
  redirect(ledgerUrl(data.paid_at, "atualizado"));
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(transactionId).success) return { ok: false, message: "Gasto inválido." };

  const locked = await lockReasonOf(supabase, transactionId);
  if (locked) return { ok: false, message: locked };

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .is("bill_id", null)
    .select("paid_at")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Não foi possível excluir o gasto." };

  revalidateAll();
  redirect(ledgerUrl(data.paid_at, "excluido"));
}
