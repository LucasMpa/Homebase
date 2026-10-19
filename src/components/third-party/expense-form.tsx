"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { describedBy, FormField } from "@/components/form-field";
import { MonthlyCostPreview, type CommittedExpense } from "@/components/third-party/monthly-cost-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseBRL } from "@/lib/money";
import { isPlainDate } from "@/lib/recurrence";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import { expenseFormSchema, MAX_INSTALLMENTS, type ExpenseFormValues } from "@/lib/validation/third-party";
import type { ExpenseFormState } from "@/server/third-party-actions";

const LOCKED_HINT = "Já há parcelas acertadas. Para mudar valor, parcelas ou data, desfaça os acertos.";

export function ExpenseForm({
  action,
  initialValues,
  people,
  committed,
  submitLabel,
  cancelHref,
  autoFocus = true,
  scheduleLocked = false,
}: {
  action: (state: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;
  initialValues: ExpenseFormValues;
  people: string[];
  /** Outros gastos ainda a receber, para a prévia do custo mensal. */
  committed: CommittedExpense[];
  submitLabel: string;
  cancelHref: string;
  autoFocus?: boolean;
  /** Já há parcela acertada: valor, parcelas e data da compra ficam travados (o servidor também recusa). */
  scheduleLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<ExpenseFormValues>(initialValues);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  // Erros do servidor valem até o próximo envio; erros locais são recalculados a cada envio.
  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  const set = (key: keyof ExpenseFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = expenseFormSchema.safeParse(values);
    if (!parsed.success) {
      setClientErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setClientErrors({});
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) formData.set(key, value);
    startTransition(() => formAction(formData));
  }

  // Prévia só com valor, parcelas e data válidos; o resto do formulário pode estar incompleto.
  const cents = parseBRL(values.amount);
  const installments = values.installments.trim() === "" ? 1 : Number(values.installments);
  const showPreview =
    cents !== null &&
    Number.isSafeInteger(cents) &&
    cents > 0 &&
    Number.isInteger(installments) &&
    installments >= 1 &&
    installments <= MAX_INSTALLMENTS &&
    isPlainDate(values.purchaseDate);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {state.message && (
        <p role="alert" className="rounded-lg border border-overdue bg-secondary p-3 text-sm">
          {state.message}
        </p>
      )}

      <FormField id="person" label="Quem fez o gasto" error={errors.person}>
        <Input
          id="person"
          value={values.person}
          onChange={(e) => set("person")(e.target.value)}
          list="person-suggestions"
          placeholder="Ex.: Ana"
          maxLength={60}
          autoComplete="off"
          aria-invalid={!!errors.person}
          aria-describedby={describedBy("person", errors.person)}
          autoFocus={autoFocus && !values.person}
        />
        <datalist id="person-suggestions">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </FormField>

      <FormField id="description" label="O que foi comprado" error={errors.description}>
        <Input
          id="description"
          value={values.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder="Ex.: Tênis, farmácia, iFood…"
          maxLength={120}
          aria-invalid={!!errors.description}
          aria-describedby={describedBy("description", errors.description)}
          autoFocus={autoFocus && !!values.person}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="amount" label="Valor total (R$)" error={errors.amount} hint={scheduleLocked ? LOCKED_HINT : undefined}>
          <Input
            id="amount"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set("amount")(e.target.value)}
            placeholder="0,00"
            autoComplete="off"
            readOnly={scheduleLocked}
            aria-invalid={!!errors.amount}
            aria-describedby={describedBy("amount", errors.amount, scheduleLocked ? LOCKED_HINT : undefined)}
          />
        </FormField>

        <FormField id="installments" label="Parcelas" error={errors.installments}>
          <Input
            id="installments"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_INSTALLMENTS}
            value={values.installments}
            onChange={(e) => set("installments")(e.target.value)}
            readOnly={scheduleLocked}
            aria-invalid={!!errors.installments}
            aria-describedby={describedBy("installments", errors.installments)}
          />
        </FormField>

        <FormField id="purchaseDate" label="Data da compra" error={errors.purchaseDate}>
          <Input
            id="purchaseDate"
            type="date"
            value={values.purchaseDate}
            onChange={(e) => set("purchaseDate")(e.target.value)}
            readOnly={scheduleLocked}
            aria-invalid={!!errors.purchaseDate}
            aria-describedby={describedBy("purchaseDate", errors.purchaseDate)}
          />
        </FormField>
      </div>

      {showPreview && (
        <MonthlyCostPreview
          person={values.person}
          amountCents={cents}
          installments={installments}
          purchaseDate={values.purchaseDate}
          committed={committed}
        />
      )}

      <FormField id="notes" label="Observação" optional error={errors.notes}>
        <Textarea
          id="notes"
          value={values.notes}
          onChange={(e) => set("notes")(e.target.value)}
          rows={3}
          maxLength={1000}
          aria-invalid={!!errors.notes}
          aria-describedby={describedBy("notes", errors.notes)}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
