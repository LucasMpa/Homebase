import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { createTransaction } from "@/server/transaction-actions";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Novo gasto" };

export default async function NewTransactionPage() {
  const today = await getToday();
  return (
    <>
      <PageHeader title="Novo gasto" />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <TransactionForm
          action={createTransaction}
          maxDate={today}
          submitLabel="Salvar gasto"
          cancelHref="/transactions"
          initialValues={{ description: "", amount: "", paidAt: today, category: "", notes: "" }}
        />
      </div>
    </>
  );
}
