import { ArchiveIcon, ArrowLeftIcon, HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BillActions } from "@/components/bills/bill-actions";
import { OccurrenceRow } from "@/components/bills/occurrence-row";
import { UndoPaymentButton } from "@/components/bills/undo-payment-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CATEGORY_LABELS, describeFrequency, formatDate } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import {
  addDays,
  buildOccurrences,
  indexPayments,
  nextOccurrences,
  occurrencesBetween,
  occurrenceStatus,
  todayInSaoPaulo,
  type Occurrence,
} from "@/lib/recurrence";
import { getBill, listPayments, type Bill } from "@/server/bills";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Conta" };

const UPCOMING_COUNT = 6;

export default async function BillDetailPage({ params }: PageProps<"/bills/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [bill, payments] = await Promise.all([getBill(id), listPayments({ billId: id })]);
  if (!bill) notFound();

  const today = await getToday();
  const archived = bill.archivedAt !== null;

  const overdue = buildOccurrences([bill], payments, bill.startDate, addDays(today, -1), today).filter(
    (o) => o.status === "overdue",
  );
  const byKey = indexPayments(payments);
  const upcoming: Occurrence<Bill>[] = nextOccurrences(bill.rule, today, UPCOMING_COUNT).map((dueDate) => {
    const payment = byKey.get(`${bill.id}|${dueDate}`) ?? null;
    return { bill, dueDate, payment, status: occurrenceStatus(dueDate, payment !== null, today) };
  });

  // Pagamentos cujo vencimento não pertence mais à regra (após mudança de frequência/data).
  const activeRule = { ...bill.rule, archived: false };
  const outsideRule = (dueDate: string) => occurrencesBetween(activeRule, dueDate, dueDate).length === 0;
  const totalPaid = payments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <Link
        href={archived ? "/bills?archived=1" : "/bills"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Contas
      </Link>

      <PageHeader
        title={bill.name}
        description={
          <div className="space-y-1">
            <p>
              {describeFrequency(bill.frequency, bill.startDate)}
              {bill.endDate && ` · até ${formatDate(bill.endDate)}`}
            </p>
            <p>
              <span className="mr-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {CATEGORY_LABELS[bill.category]}
              </span>
              Valor estimado:{" "}
              <span className="text-foreground">
                {bill.estimatedAmountCents === null ? "não informado" : formatBRL(bill.estimatedAmountCents)}
              </span>
            </p>
          </div>
        }
        actions={
          <BillActions billId={bill.id} billName={bill.name} archived={archived} paymentCount={payments.length} />
        }
      />

      {bill.notes && (
        <p className="mb-6 rounded-xl bg-card p-4 text-sm whitespace-pre-line ring-1 ring-foreground/10">{bill.notes}</p>
      )}

      {archived && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-muted p-4 text-sm ring-1 ring-border">
          <ArchiveIcon className="size-4 text-muted-foreground" aria-hidden />
          Conta arquivada em {formatDate(todayInSaoPaulo(new Date(bill.archivedAt!)))}. Ela não gera novos vencimentos;
          o histórico de pagamentos continua abaixo.
        </p>
      )}

      <div className="space-y-8">
        {overdue.length > 0 && (
          <section aria-labelledby="overdue-title" className="rounded-xl border-l-4 border-overdue bg-secondary p-4 ring-1 ring-overdue/60">
            <h2 id="overdue-title" className="font-heading text-lg font-semibold">
              Atrasadas <span className="text-overdue-foreground tabular-nums">({overdue.length})</span>
            </h2>
            <ul className="divide-y divide-overdue/30">
              {overdue.map((o) => (
                <OccurrenceRow key={o.dueDate} occurrence={o} today={today} showBillName={false} showStatus={false} />
              ))}
            </ul>
          </section>
        )}

        {!archived && (
          <section aria-labelledby="upcoming-title">
            <h2 id="upcoming-title" className="mb-2 font-heading text-lg font-semibold">
              Próximos vencimentos
            </h2>
            {upcoming.length === 0 ? (
              <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
                Nenhum vencimento futuro{bill.endDate ? ` — a conta terminou em ${formatDate(bill.endDate)}` : ""}.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
                {upcoming.map((o) => (
                  <OccurrenceRow key={o.dueDate} occurrence={o} today={today} showBillName={false} />
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="history-title">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="history-title" className="font-heading text-lg font-semibold">
              Histórico de pagamentos
            </h2>
            {payments.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total pago: <span className="font-semibold text-foreground tabular-nums">{formatBRL(totalPaid)}</span>
              </p>
            )}
          </div>
          {payments.length === 0 ? (
            <EmptyState icon={HistoryIcon} title="Nenhum pagamento registrado" />
          ) : (
            <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
              {payments.map((p) => (
                <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      Vencimento <span className="font-medium">{formatDate(p.dueDate)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pago em {formatDate(p.paidAt)}
                      {outsideRule(p.dueDate) && " · fora da regra atual"}
                    </p>
                  </div>
                  <span className="text-right text-sm font-semibold whitespace-nowrap tabular-nums">
                    {formatBRL(p.amountCents)}
                  </span>
                  <UndoPaymentButton billId={bill.id} dueDate={p.dueDate} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
