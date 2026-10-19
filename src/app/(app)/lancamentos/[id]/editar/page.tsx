import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { DeleteTransactionButton } from "@/components/transactions/delete-transaction-button";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { centsToInput } from "@/lib/money";
import { monthOf } from "@/lib/months";
import { updateTransaction } from "@/server/transaction-actions";
import { getTransaction } from "@/server/transactions";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Editar gasto" };

export default async function EditTransactionPage({ params }: PageProps<"/lancamentos/[id]/editar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [transaction, today] = await Promise.all([getTransaction(id), getToday()]);
  if (!transaction) notFound();
  // Pagamento de conta só muda pela conta.
  if (transaction.billId) redirect(`/contas/${transaction.billId}`);

  return (
    <>
      <PageHeader
        title="Editar gasto"
        description={transaction.description}
        actions={<DeleteTransactionButton transactionId={transaction.id} description={transaction.description} />}
      />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <TransactionForm
          action={updateTransaction.bind(null, transaction.id)}
          maxDate={today}
          submitLabel="Salvar alterações"
          cancelHref={`/lancamentos?mes=${monthOf(transaction.paidAt)}`}
          autoFocus={false}
          initialValues={{
            description: transaction.description,
            amount: centsToInput(transaction.amountCents),
            paidAt: transaction.paidAt,
            category: transaction.category,
            notes: transaction.notes ?? "",
          }}
        />
      </div>
    </>
  );
}
