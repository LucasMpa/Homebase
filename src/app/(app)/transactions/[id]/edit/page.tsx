import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { DeleteTransactionButton } from "@/features/transactions/components/delete-transaction-button";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { centsToInput } from "@/lib/money";
import { monthOf } from "@/lib/months";
import { updateTransaction } from "@/features/transactions/server/actions";
import { getTransaction } from "@/features/transactions/server/queries";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Editar gasto" };

export default async function EditTransactionPage({ params }: PageProps<"/transactions/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [transaction, today] = await Promise.all([getTransaction(id), getToday()]);
  if (!transaction) notFound();
  // Pagamento de conta só muda pela conta.
  if (transaction.billId) redirect(`/bills/${transaction.billId}`);

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
          cancelHref={`/transactions?month=${monthOf(transaction.paidAt)}`}
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
