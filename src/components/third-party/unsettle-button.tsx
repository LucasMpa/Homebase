"use client";

import { Undo2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { InstallmentRef } from "@/lib/validation/third-party";
import { unsettleInstallments } from "@/server/third-party-actions";

/** Desfaz o acerto das parcelas indicadas. `compact` mostra só o ícone (lista de parcelas). */
export function UnsettleButton({
  items,
  message,
  compact = false,
}: {
  items: InstallmentRef[];
  message: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size={compact ? "icon-xs" : "sm"}
      variant="ghost"
      disabled={pending}
      aria-label={compact ? "Desfazer acerto" : undefined}
      title={compact ? "Desfazer acerto" : undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await unsettleInstallments(items);
          if (result.ok) toast(message);
          else toast.error(result.message);
        })
      }
    >
      <Undo2Icon aria-hidden /> {!compact && "Desfazer"}
    </Button>
  );
}
