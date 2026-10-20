import { CalendarCheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OccurrenceRow } from "@/components/bills/occurrence-row";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, monthName } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { addDays, buildMonthView, endOfMonth, isPlainDate, parsePlainDate, startOfMonth, type PlainDate } from "@/lib/recurrence";
import { listBills, listPayments } from "@/server/bills";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Este mês" };

/** "?month=2026-09" → "2026-09-01"; inválido ou ausente → mês atual. */
function resolveMonth(param: string | string[] | undefined, today: PlainDate): PlainDate {
  const candidate = typeof param === "string" ? `${param}-01` : "";
  return /^\d{4}-\d{2}-01$/.test(candidate) && isPlainDate(candidate) ? candidate : startOfMonth(today);
}

const monthParam = (date: PlainDate) => date.slice(0, 7);

function monthLabel(date: PlainDate) {
  return `${monthName(date)} de ${parsePlainDate(date).year}`;
}

/** "outubro de 2026" → "Outubro de 2026" (o `capitalize` do CSS colocaria "De"). */
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default async function MonthPage({ searchParams }: PageProps<"/month">) {
  const today = await getToday();
  const month = resolveMonth((await searchParams).month, today);
  const isCurrent = month === startOfMonth(today);
  const prev = startOfMonth(addDays(month, -1));
  const next = addDays(endOfMonth(month), 1);

  // Arquivadas entram para nomear pagamentos antigos; elas não geram vencimentos.
  const [active, archived, payments] = await Promise.all([
    listBills({ archived: false }),
    listBills({ archived: true }),
    listPayments(),
  ]);
  const bills = [...active, ...archived];
  const billsById = new Map(bills.map((b) => [b.id, b]));
  const view = buildMonthView(bills, payments, month, today);
  const total = view.paid.length + view.pending.length;
  const name = monthName(month);

  const monthNav = (
    <nav aria-label="Mês" className="mb-6 flex items-center justify-between gap-2">
      <Link
        href={`/month?month=${monthParam(prev)}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label={`Mês anterior: ${monthLabel(prev)}`}
      >
        <ChevronLeftIcon aria-hidden /> <span className="capitalize">{monthName(prev)}</span>
      </Link>
      {!isCurrent && (
        <Link href="/month" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Voltar ao mês atual
        </Link>
      )}
      <Link
        href={`/month?month=${monthParam(next)}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label={`Próximo mês: ${monthLabel(next)}`}
      >
        <span className="capitalize">{monthName(next)}</span> <ChevronRightIcon aria-hidden />
      </Link>
    </nav>
  );

  const header = (
    <PageHeader
      title={upperFirst(monthLabel(month))}
      description={isCurrent ? "Contas que vencem neste mês" : "Contas que vencem no mês"}
    />
  );

  if (active.length === 0 && view.otherPayments.length === 0 && view.paid.length === 0) {
    return (
      <>
        {header}
        {monthNav}
        <EmptyState
          icon={ReceiptTextIcon}
          title="Nenhuma conta cadastrada ainda"
          action={
            <Link href="/bills/new" className={buttonVariants()}>
              <PlusIcon aria-hidden /> Cadastrar conta
            </Link>
          }
        />
      </>
    );
  }

  const progress = total === 0 ? 0 : Math.round((view.paid.length / total) * 100);

  return (
    <>
      {header}
      {monthNav}

      <section aria-label={`Resumo de ${name}`} className="mb-8 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="mt-1 font-heading text-xl font-semibold text-primary tabular-nums md:text-2xl">
              {formatBRL(view.paidCents)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Falta pagar</p>
            <p className="mt-1 font-heading text-xl font-semibold tabular-nums md:text-2xl">{formatBRL(view.pendingCents)}</p>
            {view.pendingWithoutAmountCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                + {view.pendingWithoutAmountCount} {view.pendingWithoutAmountCount === 1 ? "conta" : "contas"} sem valor
              </p>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm">
              <span className="font-semibold tabular-nums">
                {view.paid.length} de {total}
              </span>{" "}
              <span className="text-muted-foreground">{total === 1 ? "conta paga" : "contas pagas"}</span>
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={view.paid.length}
              aria-label="Contas pagas no mês"
              className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-border"
            >
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </section>

      <div className="space-y-8">
        {total === 0 && (
          <EmptyState icon={CalendarCheckIcon} title={`Nenhuma conta vence em ${name}`} />
        )}

        {view.pending.length > 0 && (
          <section aria-labelledby="pending-title">
            <h2 id="pending-title" className="mb-2 font-heading text-lg font-semibold">
              Faltam pagar <span className="text-muted-foreground tabular-nums">({view.pending.length})</span>
            </h2>
            <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
              {view.pending.map((o) => (
                <OccurrenceRow key={`${o.bill.id}-${o.dueDate}`} occurrence={o} today={today} />
              ))}
            </ul>
          </section>
        )}

        {view.paid.length > 0 && (
          <section aria-labelledby="paid-title">
            <h2 id="paid-title" className="mb-2 font-heading text-lg font-semibold">
              Pagas <span className="text-muted-foreground tabular-nums">({view.paid.length})</span>
            </h2>
            <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
              {view.paid.map((o) => (
                <OccurrenceRow key={`${o.bill.id}-${o.dueDate}`} occurrence={o} today={today} />
              ))}
            </ul>
          </section>
        )}

        {view.otherPayments.length > 0 && (
          <section aria-labelledby="other-title">
            <h2 id="other-title" className="font-heading text-lg font-semibold">
              Pagos em {name}, de outros meses
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">Pagamentos adiantados ou atrasados feitos neste mês.</p>
            <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
              {view.otherPayments.map((p) => {
                const bill = billsById.get(p.billId);
                return (
                  <li key={`${p.billId}-${p.dueDate}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/bills/${p.billId}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {bill?.name ?? "Conta"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Vencimento {formatDate(p.dueDate)} · pago em {formatDate(p.paidAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(p.amountCents)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
