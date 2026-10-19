import type { Metadata } from "next";
import { BillForm } from "@/components/bills/bill-form";
import { PageHeader } from "@/components/page-header";
import { getToday } from "@/server/today";
import { createBill } from "@/server/actions";

export const metadata: Metadata = { title: "Nova conta" };

export default async function NewBillPage() {
  return (
    <>
      <PageHeader title="Nova conta" />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <BillForm
          action={createBill}
          submitLabel="Cadastrar conta"
          cancelHref="/contas"
          initialValues={{
            name: "",
            category: "",
            frequency: "monthly",
            startDate: await getToday(),
            endDate: "",
            estimatedAmount: "",
            notes: "",
          }}
        />
      </div>
    </>
  );
}
