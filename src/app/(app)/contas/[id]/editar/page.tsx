import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BillForm } from "@/components/bills/bill-form";
import { PageHeader } from "@/components/page-header";
import { centsToInput } from "@/lib/money";
import { updateBill } from "@/server/actions";
import { getBill, listPayments } from "@/server/bills";

export const metadata: Metadata = { title: "Editar conta" };

export default async function EditBillPage({ params }: PageProps<"/contas/[id]/editar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [bill, payments] = await Promise.all([getBill(id), listPayments({ billId: id })]);
  if (!bill || bill.archivedAt) notFound();

  return (
    <>
      <PageHeader title="Editar conta" description={bill.name} />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <BillForm
          action={updateBill.bind(null, bill.id)}
          submitLabel="Salvar alterações"
          cancelHref={`/contas/${bill.id}`}
          original={{ frequency: bill.frequency, startDate: bill.startDate, hasPayments: payments.length > 0 }}
          initialValues={{
            name: bill.name,
            category: bill.category,
            frequency: bill.frequency,
            startDate: bill.startDate,
            endDate: bill.endDate ?? "",
            estimatedAmount: centsToInput(bill.estimatedAmountCents),
            notes: bill.notes ?? "",
          }}
        />
      </div>
    </>
  );
}
