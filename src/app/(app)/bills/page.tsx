import { ArchiveIcon, ChevronRightIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORY_LABELS, describeFrequency, formatDate } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { addDays, buildOccurrences, nextOccurrences, type PlainDate } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { listBills, listPayments, type Bill, type Payment } from "@/server/bills";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Contas" };

export default async function BillsPage({ searchParams }: PageProps<"/bills">) {
  const archived = (await searchParams).arquivadas === "1";
  const today = await getToday();
  const [bills, payments] = await Promise.all([listBills({ archived }), listPayments()]);

  return (
    <>
      <PageHeader
        title="Contas"
        actions={
          <Link href="/bills/new" className={buttonVariants()}>
            <PlusIcon aria-hidden /> Nova conta
          </Link>
        }
      />

      <SegmentedNav
        label="Filtro"
        items={[
          { href: "/bills", label: "Ativas", active: !archived },
          { href: "/bills?arquivadas=1", label: "Arquivadas", active: archived },
        ]}
      />

      {bills.length === 0 ? (
        archived ? (
          <EmptyState icon={ArchiveIcon} title="Nenhuma conta arquivada" />
        ) : (
          <EmptyState
            icon={ReceiptTextIcon}
            title="Nenhuma conta cadastrada ainda"
            description="Comece pela conta que mais costuma ser esquecida."
            action={
              <Link href="/bills/new" className={buttonVariants()}>
                <PlusIcon aria-hidden /> Cadastrar conta
              </Link>
            }
          />
        )
      ) : (
        <ul className="grid gap-3">
          {bills.map((bill) => (
            <li key={bill.id}>
              <BillCard bill={bill} payments={payments} today={today} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function BillCard({ bill, payments, today }: { bill: Bill; payments: Payment[]; today: PlainDate }) {
  const own = payments.filter((p) => p.billId === bill.id);
  const pending = buildOccurrences([bill], own, bill.startDate, addDays(today, -1), today).filter(
    (o) => o.status === "overdue",
  );
  const paidDates = new Set(own.map((p) => p.dueDate));
  const next = nextOccurrences(bill.rule, today, 24).find((d) => !paidDates.has(d));

  return (
    <Link
      href={`/bills/${bill.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        pending.length > 0 && "ring-overdue/70",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{bill.name}</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {CATEGORY_LABELS[bill.category]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {describeFrequency(bill.frequency, bill.startDate)}
          {bill.estimatedAmountCents !== null && ` · ${formatBRL(bill.estimatedAmountCents)}`}
        </p>
        {!bill.archivedAt && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            {pending.length > 0 && <StatusBadge status="overdue" />}
            {pending.length > 1 && <span className="text-overdue-foreground">{pending.length} pendentes</span>}
            {next ? (
              <span className="text-muted-foreground">
                Próximo: <span className="text-foreground">{formatDate(next)}</span>
                {next === today && " (hoje)"}
              </span>
            ) : (
              pending.length === 0 && <span className="text-muted-foreground">Sem próximos vencimentos</span>
            )}
          </div>
        )}
      </div>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
