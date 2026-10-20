import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/third-party/expense-form";
import { createExpense } from "@/server/third-party-actions";
import { listExpenses, listExpenseSuggestions } from "@/server/third-party";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Novo gasto de terceiro" };

export default async function NewExpensePage() {
  const [{ people }, pending, today] = await Promise.all([
    listExpenseSuggestions(),
    listExpenses({ settled: false }),
    getToday(),
  ]);
  return (
    <>
      <PageHeader title="Novo gasto de terceiro" />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <ExpenseForm
          action={createExpense}
          people={people}
          committed={pending}
          submitLabel="Cadastrar gasto"
          cancelHref="/third-party"
          initialValues={{
            // Com uma só pessoa cadastrada (o caso comum), ela já vem preenchida.
            person: people.length === 1 ? people[0] : "",
            description: "",
            amount: "",
            purchaseDate: today,
            installments: "1",
            notes: "",
          }}
        />
      </div>
    </>
  );
}
