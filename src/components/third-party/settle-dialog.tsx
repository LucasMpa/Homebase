"use client";

import { HandCoinsIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { formatBRL } from "@/lib/money";
import { todayInSaoPaulo } from "@/lib/recurrence";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import { settleSchema, type InstallmentRef } from "@/lib/validation/third-party";
import { settleInstallments, unsettleInstallments } from "@/server/third-party-actions";

/** Registra que a pessoa pagou: uma parcela, as restantes de um gasto ou várias de uma vez. */
export function SettleDialog({
  items,
  title,
  description,
  totalCents,
  label,
  size = "sm",
  variant = "default",
}: {
  items: InstallmentRef[];
  title: string;
  description: string;
  totalCents: number;
  label: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [settledAt, setSettledAt] = useState(() => todayInSaoPaulo());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSettledAt(todayInSaoPaulo());
      setErrors({});
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = settleSchema.safeParse({ items, settledAt });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await settleInstallments(items, settledAt);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      setOpen(false);
      toast.success(`${formatBRL(totalCents)} recebido`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            const undo = await unsettleInstallments(items);
            if (undo.ok) toast("Acerto desfeito");
            else toast.error(undo.message);
          },
        },
      });
    });
  }

  const dateId = `${id}-settled-at`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size={size} variant={variant} />}>
        <HandCoinsIcon aria-hidden /> {label}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <p className="rounded-lg bg-muted p-3 text-sm ring-1 ring-border">
            Valor recebido:{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatBRL(totalCents)}</span>
          </p>

          <FormField id={dateId} label="Data do acerto" error={errors.settledAt ?? errors.items}>
            <Input
              id={dateId}
              type="date"
              value={settledAt}
              max={todayInSaoPaulo()}
              onChange={(e) => setSettledAt(e.target.value)}
              aria-invalid={!!errors.settledAt}
              aria-describedby={describedBy(dateId, errors.settledAt ?? errors.items)}
              autoFocus
            />
          </FormField>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Confirmar acerto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
