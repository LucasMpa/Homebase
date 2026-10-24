"use client";

import { Undo2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import type { InstallmentRef } from "@/lib/validation/third-party";
import { unsettleInstallments } from "@/server/third-party-actions";

/** Desfaz o acerto das parcelas indicadas. `ariaLabel` diz qual, quando há vários "Desfazer" na tela. */
export function UnsettleButton({
  items,
  message,
  ariaLabel,
  className,
}: {
  items: InstallmentRef[];
  message: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={ariaLabel}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const result = await unsettleInstallments(items);
          if (result.ok) toast(message);
          else toast.error(result.message);
        })
      }
    >
      <Undo2Icon aria-hidden /> Desfazer
    </Button>
  );
}
