"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteBill, setBillArchived } from "@/server/actions";

export function BillActions({
  billId,
  billName,
  archived,
  paymentCount,
}: {
  billId: string;
  billName: string;
  archived: boolean;
  paymentCount: number;
}) {
  const [pending, startTransition] = useTransition();

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await setBillArchived(billId, !archived);
      if (result.ok) toast(archived ? "Conta reativada" : "Conta arquivada");
      else toast.error(result.message);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteBill(billId);
      // Em caso de sucesso a action redireciona para /contas.
      if (result && !result.ok) toast.error(result.message);
    });

  return (
    <>
      {!archived && (
        <Link href={`/contas/${billId}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <PencilIcon aria-hidden /> Editar
        </Link>
      )}
      <Button variant="outline" size="sm" onClick={toggleArchive} disabled={pending}>
        {archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
        {archived ? "Desarquivar" : "Arquivar"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={pending} />}>
          <Trash2Icon aria-hidden /> Excluir
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{billName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentCount === 1
                ? "O pagamento registrado também será apagado e deixará de contar em Lançamentos e Relatórios. "
                : paymentCount > 1
                  ? `Os ${paymentCount} pagamentos registrados também serão apagados e deixarão de contar em Lançamentos e Relatórios. `
                  : ""}
              Essa ação não pode ser desfeita. Para manter o histórico, arquive a conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Excluindo…" : "Excluir conta"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
