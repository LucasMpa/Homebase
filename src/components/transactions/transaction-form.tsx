"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { describedBy, FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS } from "@/lib/format";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import { transactionFormSchema, type TransactionFormValues } from "@/lib/validation/transactions";
import type { TransactionFormState } from "@/server/transaction-actions";

const PAID_AT_HINT = "Dia em que o dinheiro saiu";

export function TransactionForm({
  action,
  initialValues,
  maxDate,
  submitLabel,
  cancelHref,
  autoFocus = true,
}: {
  action: (state: TransactionFormState, formData: FormData) => Promise<TransactionFormState>;
  initialValues: TransactionFormValues;
  /** "Hoje" em São Paulo, calculado no servidor (no cliente daria erro de hidratação). */
  maxDate: string;
  submitLabel: string;
  cancelHref: string;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<TransactionFormValues>(initialValues);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  // Erros do servidor valem até o próximo envio; erros locais são recalculados a cada envio.
  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  const set = (key: keyof TransactionFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = transactionFormSchema.safeParse(values);
    if (!parsed.success) {
      setClientErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setClientErrors({});
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) formData.set(key, value);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {state.message && (
        <p role="alert" className="rounded-lg border border-overdue bg-secondary p-3 text-sm">
          {state.message}
        </p>
      )}

      <FormField id="description" label="O que foi pago" error={errors.description}>
        <Input
          id="description"
          value={values.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder="Ex.: Ingresso do show, mercado, farmácia…"
          maxLength={120}
          aria-invalid={!!errors.description}
          aria-describedby={describedBy("description", errors.description)}
          autoFocus={autoFocus}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="amount" label="Valor (R$)" error={errors.amount}>
          <Input
            id="amount"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set("amount")(e.target.value)}
            placeholder="0,00"
            autoComplete="off"
            aria-invalid={!!errors.amount}
            aria-describedby={describedBy("amount", errors.amount)}
          />
        </FormField>

        <FormField id="paidAt" label="Data" error={errors.paidAt} hint={PAID_AT_HINT}>
          <Input
            id="paidAt"
            type="date"
            value={values.paidAt}
            max={maxDate}
            onChange={(e) => set("paidAt")(e.target.value)}
            aria-invalid={!!errors.paidAt}
            aria-describedby={describedBy("paidAt", errors.paidAt, PAID_AT_HINT)}
          />
        </FormField>

        <FormField id="category" label="Categoria" error={errors.category}>
          <Select
            items={CATEGORY_LABELS}
            value={values.category || null}
            onValueChange={(v) => set("category")(v ?? "")}
          >
            <SelectTrigger
              id="category"
              className="w-full"
              aria-invalid={!!errors.category}
              aria-describedby={describedBy("category", errors.category)}
            >
              <SelectValue placeholder="Escolha…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

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
