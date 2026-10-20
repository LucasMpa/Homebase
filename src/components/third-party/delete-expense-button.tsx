"use client";

import { Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/server/third-party-actions";

export function DeleteExpenseButton({ expenseId, description }: { expenseId: string; description: string }) {
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await deleteExpense(expenseId);
      // Em caso de sucesso a action redireciona para /third-party.
      if (result && !result.ok) toast.error(result.message);
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={pending} />}>
        <Trash2Icon aria-hidden /> Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{description}”?</AlertDialogTitle>
          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={remove} disabled={pending}>
            {pending ? "Excluindo…" : "Excluir gasto"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
