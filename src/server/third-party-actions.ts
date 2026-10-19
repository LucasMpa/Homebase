"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { installmentSchedule } from "@/lib/third-party";
import { fieldErrorsOf, formDataToStrings, type FieldErrors } from "@/lib/validation/common";
import {
  EXPENSE_FIELDS,
  expenseFormSchema,
  settleSchema,
  unsettleSchema,
  type ExpenseFormValues,
  type ExpenseInput,
  type InstallmentRef,
} from "@/lib/validation/third-party";
import type { ActionResult } from "@/server/actions";

/**
 * Mutações dos gastos de terceiros. Mesmo padrão de src/server/actions.ts:
 * requireUser() → validação zod → Supabase com RLS.
 */

export type ExpenseFormState = {
  message?: string;
  fieldErrors?: FieldErrors;
  values?: ExpenseFormValues;
};

const idSchema = z.uuid();

function toRow(input: ExpenseInput) {
  return {
    person: input.person,
    description: input.description,
    amount_cents: input.amount,
    purchase_date: input.purchaseDate,
    installments: input.installments,
    notes: input.notes,
  };
}

function parseExpenseForm(formData: FormData) {
  const values = formDataToStrings(formData, EXPENSE_FIELDS);
  return { values, parsed: expenseFormSchema.safeParse(values) };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const { supabase } = await requireUser();
  const { values, parsed } = parseExpenseForm(formData);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  const { error } = await supabase.from("third_party_expenses").insert(toRow(parsed.data));
  if (error) return { values, message: "Não foi possível salvar o gasto. Tente novamente." };

  revalidateAll();
  redirect("/terceiros");
}

export async function updateExpense(
  expenseId: string,
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(expenseId).success) return { message: "Gasto inválido." };
  const { values, parsed } = parseExpenseForm(formData);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) };

  const { data: current, error: readError } = await supabase
    .from("third_party_expenses")
    .select("amount_cents, installments, purchase_date, third_party_settlements(installment)")
    .eq("id", expenseId)
    .maybeSingle();
  if (readError || !current) return { values, message: "Não foi possível salvar as alterações." };

  // Com parcela acertada, o que define o valor de cada parcela não pode mudar.
  const settledCount = current.third_party_settlements.length;
  const scheduleChanged =
    parsed.data.amount !== current.amount_cents ||
    parsed.data.installments !== current.installments ||
    parsed.data.purchaseDate !== current.purchase_date;
  if (settledCount > 0 && scheduleChanged) {
    return {
      values,
      message:
        "Este gasto já tem parcelas acertadas: valor, parcelas e data da compra não podem mudar. Desfaça os acertos para alterar.",
    };
  }

  const { error, count } = await supabase
    .from("third_party_expenses")
    .update(toRow(parsed.data), { count: "exact" })
    .eq("id", expenseId);
  if (error || count !== 1) return { values, message: "Não foi possível salvar as alterações." };

  revalidateAll();
  redirect(settledCount >= current.installments ? "/terceiros?acertados=1" : "/terceiros");
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(expenseId).success) return { ok: false, message: "Gasto inválido." };
  const { error, count } = await supabase.from("third_party_expenses").delete({ count: "exact" }).eq("id", expenseId);
  if (error || count !== 1) return { ok: false, message: "Não foi possível excluir o gasto." };
  revalidateAll();
  redirect("/terceiros");
}

/**
 * Acerta parcelas (a pessoa te pagou). O valor de cada parcela é calculado aqui,
 * a partir do gasto no banco; o cliente só diz quais parcelas.
 */
export async function settleInstallments(items: InstallmentRef[], settledAt: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = settleSchema.safeParse({ items, settledAt });
  if (!parsed.success) {
    return { ok: false, message: "Confira os campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const expenseIds = [...new Set(parsed.data.items.map((i) => i.expenseId))];
  const { data: expenses, error: readError } = await supabase
    .from("third_party_expenses")
    .select("id, amount_cents, installments, purchase_date")
    .in("id", expenseIds);
  if (readError || expenses.length !== expenseIds.length) return { ok: false, message: "Gasto não encontrado." };

  const byId = new Map(expenses.map((e) => [e.id, e]));
  const rows = [];
  for (const { expenseId, installment } of parsed.data.items) {
    const e = byId.get(expenseId)!;
    const schedule = installmentSchedule({
      amountCents: e.amount_cents,
      installments: e.installments,
      purchaseDate: e.purchase_date,
    });
    const item = schedule.find((i) => i.number === installment);
    if (!item) return { ok: false, message: "Parcela inválida." };
    rows.push({ expense_id: expenseId, installment, amount_cents: item.cents, settled_at: parsed.data.settledAt });
  }

  const { error } = await supabase.from("third_party_settlements").insert(rows);
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Essa parcela já foi acertada." : "Não foi possível registrar o acerto.",
    };
  }
  revalidateAll();
  return { ok: true };
}

/** Desfaz o acerto das parcelas: elas voltam para "a receber". */
export async function unsettleInstallments(items: InstallmentRef[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = unsettleSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: "Parcela inválida." };

  // Agrupa por gasto: um delete por gasto, com as parcelas dele.
  const byExpense = new Map<string, number[]>();
  for (const { expenseId, installment } of parsed.data) {
    byExpense.set(expenseId, [...(byExpense.get(expenseId) ?? []), installment]);
  }
  let deleted = 0;
  for (const [expenseId, installments] of byExpense) {
    const { error, count } = await supabase
      .from("third_party_settlements")
      .delete({ count: "exact" })
      .eq("expense_id", expenseId)
      .in("installment", installments);
    if (error) return { ok: false, message: "Não foi possível desfazer o acerto." };
    deleted += count ?? 0;
  }
  if (deleted === 0) return { ok: false, message: "Não foi possível desfazer o acerto." };
  revalidateAll();
  return { ok: true };
}
