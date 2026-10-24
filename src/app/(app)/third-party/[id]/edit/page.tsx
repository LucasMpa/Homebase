import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { DeleteExpenseButton } from "@/components/third-party/delete-expense-button";
import { ExpenseForm } from "@/components/third-party/expense-form";
import { centsToInput } from "@/lib/money";
import { isSettled } from "@/lib/third-party";
import { updateExpense } from "@/server/third-party-actions";
import { getExpense, listExpenses, listExpenseSuggestions } from "@/server/third-party";

export const metadata: Metadata = { title: "Editar gasto" };

export default async function EditExpensePage({ params }: PageProps<"/third-party/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [expense, { people }, pending] = await Promise.all([
    getExpense(id),
    listExpenseSuggestions(),
    listExpenses({ settled: false }),
  ]);
  if (!expense) notFound();

  return (
    <>
      <PageHeader
        title="Editar gasto"
        description={`${expense.person} · ${expense.description}`}
        actions={<DeleteExpenseButton expenseId={expense.id} description={expense.description} />}
      />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <ExpenseForm
          action={updateExpense.bind(null, expense.id)}
          people={people}
          committed={pending.filter((e) => e.id !== expense.id)}
          submitLabel="Salvar alterações"
          cancelHref={isSettled(expense) ? "/third-party?acertados=1" : "/third-party"}
          autoFocus={false}
          scheduleLocked={expense.settlements.length > 0}
          initialValues={{
            person: expense.person,
            description: expense.description,
            amount: centsToInput(expense.amountCents),
            purchaseDate: expense.purchaseDate,
            installments: String(expense.installments),
            notes: expense.notes ?? "",
          }}
        />
      </div>
    </>
  );
}
