"use client";

import { CheckIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast, toastWithAction } from "@/components/ui/toast";
import { describedBy, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { centsToInput } from "@/lib/money";
import { todayInSaoPaulo } from "@/lib/recurrence";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import { paymentFormSchema } from "@/lib/validation/payments";
import { markPaid, unmarkPaid } from "@/server/actions";

export function PayDialog({
  billId,
  billName,
  dueDate,
  estimatedAmountCents,
  size = "sm",
  variant = "default",
}: {
  billId: string;
  billName: string;
  dueDate: string;
  estimatedAmountCents: number | null;
  size?: "sm" | "default";
  variant?: "default" | "outline";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(centsToInput(estimatedAmountCents));
  const [paidAt, setPaidAt] = useState(() => todayInSaoPaulo());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setAmount(centsToInput(estimatedAmountCents));
      setPaidAt(todayInSaoPaulo());
      setErrors({});
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { billId, dueDate, paidAt, amount };
    const parsed = paymentFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await markPaid(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      setOpen(false);
      toastWithAction(
        `${billName} marcada como paga`,
        {
          label: "Desfazer",
          onClick: async () => {
            const undo = await unmarkPaid(billId, dueDate);
            if (undo.ok) toast("Pagamento desfeito");
            else toast.error(undo.message);
          },
        },
        { type: "success" },
      );
    });
  }

  const amountId = `${id}-amount`;
  const paidAtId = `${id}-paid-at`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size={size} variant={variant} />}>
        <CheckIcon aria-hidden /> Marcar como paga
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Marcar como paga</DialogTitle>
            <DialogDescription>
              {billName} · vencimento {formatDate(dueDate)}
            </DialogDescription>
          </DialogHeader>

          <FormField id={amountId} label="Valor pago (R$)" error={errors.amount}>
            <Input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
              aria-describedby={describedBy(amountId, errors.amount)}
              autoFocus
            />
          </FormField>

          <FormField id={paidAtId} label="Data do pagamento" error={errors.paidAt}>
            <Input
              id={paidAtId}
              type="date"
              value={paidAt}
              max={todayInSaoPaulo()}
              onChange={(e) => setPaidAt(e.target.value)}
              aria-invalid={!!errors.paidAt}
              aria-describedby={describedBy(paidAtId, errors.paidAt)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
