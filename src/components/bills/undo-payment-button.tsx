"use client";

import { Undo2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unmarkPaid } from "@/server/actions";

export function UndoPaymentButton({ billId, dueDate }: { billId: string; dueDate: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await unmarkPaid(billId, dueDate);
          if (result.ok) toast("Pagamento desfeito");
          else toast.error(result.message);
        })
      }
    >
      <Undo2Icon aria-hidden /> Desfazer
    </Button>
  );
}
