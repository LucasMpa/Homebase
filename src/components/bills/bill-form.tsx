"use client";

import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { describedBy, FormField } from "@/components/form-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, FREQUENCY_LABELS } from "@/lib/format";
import { parsePlainDate, isPlainDate, type BillFrequency } from "@/lib/recurrence";
import { billFormSchema, type BillFormValues } from "@/lib/validation/bills";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import type { BillFormState } from "@/server/actions";

type Mode = "save" | "replace";

const END_DATE_HINT = "Sem data final, a conta se repete indefinidamente.";

export function BillForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
  original,
}: {
  action: (state: BillFormState, formData: FormData) => Promise<BillFormState>;
  initialValues: BillFormValues;
  submitLabel: string;
  cancelHref: string;
  /** Só na edição: regra atual e se já existem pagamentos. */
  original?: { frequency: BillFrequency; startDate: string; hasPayments: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<BillFormValues>(initialValues);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Erros do servidor valem até o próximo envio; erros locais são recalculados a cada envio.
  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  const set = (key: keyof BillFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  // Conta única não tem data final.
  const effective: BillFormValues = values.frequency === "once" ? { ...values, endDate: "" } : values;

  function submit(mode: Mode) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(effective)) formData.set(key, value);
    formData.set("mode", mode);
    startTransition(() => formAction(formData));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = billFormSchema.safeParse(effective);
    if (!parsed.success) {
      setClientErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setClientErrors({});
    const ruleChanged =
      original && (values.frequency !== original.frequency || values.startDate !== original.startDate);
    if (original?.hasPayments && ruleChanged) {
      setConfirmOpen(true);
      return;
    }
    submit("save");
  }

  const startDay = isPlainDate(values.startDate) ? parsePlainDate(values.startDate).day : null;
  const startHint =
    values.frequency === "monthly" && startDay !== null && startDay > 28
      ? `Nos meses sem dia ${startDay}, o vencimento cai no último dia do mês.`
      : values.frequency === "yearly" && values.startDate.endsWith("-02-29")
        ? "Em anos não bissextos, o vencimento cai em 28/02."
        : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {state.message && (
        <p role="alert" className="rounded-lg border border-overdue bg-secondary p-3 text-sm">
          {state.message}
        </p>
      )}

      <FormField id="name" label="Nome" error={errors.name}>
        <Input
          id="name"
          value={values.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="Ex.: Conta de luz"
          maxLength={120}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy("name", errors.name)}
          autoFocus={!original}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
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

        <FormField id="frequency" label="Frequência" error={errors.frequency}>
          <Select
            items={FREQUENCY_LABELS}
            value={values.frequency || null}
            onValueChange={(v) => set("frequency")(v ?? "")}
          >
            <SelectTrigger
              id="frequency"
              className="w-full"
              aria-invalid={!!errors.frequency}
              aria-describedby={describedBy("frequency", errors.frequency)}
            >
              <SelectValue placeholder="Escolha…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="startDate"
          label={values.frequency === "once" ? "Data de vencimento" : "Primeiro vencimento"}
          error={errors.startDate}
          hint={startHint}
        >
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate")(e.target.value)}
            aria-invalid={!!errors.startDate}
            aria-describedby={describedBy("startDate", errors.startDate, startHint)}
          />
        </FormField>

        {values.frequency !== "once" && (
          <FormField
            id="endDate"
            label="Data final"
            optional
            error={errors.endDate}
            hint={END_DATE_HINT}
          >
            <Input
              id="endDate"
              type="date"
              value={values.endDate}
              min={values.startDate || undefined}
              onChange={(e) => set("endDate")(e.target.value)}
              aria-invalid={!!errors.endDate}
              aria-describedby={describedBy("endDate", errors.endDate, END_DATE_HINT)}
            />
          </FormField>
        )}
      </div>

      <FormField id="estimatedAmount" label="Valor estimado (R$)" optional error={errors.estimatedAmount}>
        <Input
          id="estimatedAmount"
          inputMode="decimal"
          value={values.estimatedAmount}
          onChange={(e) => set("estimatedAmount")(e.target.value)}
          placeholder="0,00"
          autoComplete="off"
          aria-invalid={!!errors.estimatedAmount}
          aria-describedby={describedBy("estimatedAmount", errors.estimatedAmount)}
        />
      </FormField>

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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-primary" aria-hidden /> Mudar a regra desta conta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta conta já tem pagamentos registrados. Ao mudar a frequência ou o primeiro vencimento, os pagamentos
              antigos podem não corresponder às novas datas e deixar de aparecer como pagos. Se a conta mudou de
              verdade, é melhor arquivar esta e criar uma nova, preservando o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                submit("save");
              }}
            >
              Salvar mesmo assim
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                submit("replace");
              }}
            >
              Arquivar e criar nova
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
