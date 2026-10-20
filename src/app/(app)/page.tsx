import { AlertTriangleIcon, CalendarCheckIcon, CircleDotIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OccurrenceRow } from "@/components/bills/occurrence-row";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { buildMonthSummary, buildWeekView, parsePlainDate, type Occurrence } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { listBills, listPayments, type Bill } from "@/server/bills";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Esta semana" };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function HomePage() {
  const today = await getToday();
  const [bills, payments] = await Promise.all([listBills({ archived: false }), listPayments()]);

  if (bills.length === 0) {
    return (
      <>
        <PageHeader title="Esta semana" description={`Hoje é ${formatDate(today)}`} />
        <EmptyState
          icon={ReceiptTextIcon}
          title="Nenhuma conta cadastrada ainda"
          description="Cadastre luz, água, internet, aluguel… e o Homebase avisa o que vence."
          action={
            <Link href="/bills/new" className={buttonVariants()}>
              <PlusIcon aria-hidden /> Cadastrar conta
            </Link>
          }
        />
      </>
    );
  }

  const week = buildWeekView(bills, payments, today);
  const summary = buildMonthSummary(bills, payments, today);
  const monthName = MONTHS[parsePlainDate(today).month - 1];
  const nothingPending = week.overdue.length === 0 && week.dueToday.length === 0 && week.nextSevenDays.length === 0;

  return (
    <>
      <PageHeader title="Esta semana" description={`Hoje é ${formatDate(today)}`} />

      <section aria-label={`Resumo de ${monthName}`} className="mb-8 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Previsto em {monthName}</p>
          <p className="mt-1 font-heading text-xl font-semibold tabular-nums md:text-2xl">{formatBRL(summary.expectedCents)}</p>
          {summary.withoutAmountCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              + {summary.withoutAmountCount} {summary.withoutAmountCount === 1 ? "ocorrência" : "ocorrências"} sem valor
            </p>
          )}
        </div>
        <Link
          href="/month"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <p className="text-sm text-muted-foreground">Pago em {monthName}</p>
          <p className="mt-1 font-heading text-xl font-semibold text-primary tabular-nums md:text-2xl">
            {formatBRL(summary.paidCents)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground underline-offset-4">Ver contas do mês →</p>
        </Link>
      </section>

      {nothingPending && (
        <EmptyState
          icon={CalendarCheckIcon}
          title="Tudo em dia"
          description="Nada atrasado e nada vencendo nos próximos 7 dias."
        />
      )}

      <div className="space-y-8">
        {week.overdue.length > 0 && <OverdueSection occurrences={week.overdue} today={today} />}

        {week.dueToday.length > 0 && (
          <section aria-labelledby="due-today-title" className="rounded-xl bg-card p-4 ring-2 ring-primary">
            <h2 id="due-today-title" className="flex items-center gap-2 font-heading text-lg font-semibold text-primary">
              <CircleDotIcon className="size-5" aria-hidden /> Vence hoje
            </h2>
            <ul className="divide-y divide-border">
              {week.dueToday.map((o) => (
                <OccurrenceRow key={`${o.bill.id}-${o.dueDate}`} occurrence={o} today={today} showStatus={false} />
              ))}
            </ul>
          </section>
        )}

        {week.nextSevenDays.length > 0 && (
          <section aria-labelledby="next-days-title">
            <h2 id="next-days-title" className="mb-2 font-heading text-lg font-semibold">
              Próximos 7 dias
            </h2>
            <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
              {week.nextSevenDays.map((o) => (
                <OccurrenceRow key={`${o.bill.id}-${o.dueDate}`} occurrence={o} today={today} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/** Atrasadas agrupadas por conta, para que uma conta antiga sem pagamentos não inunde a tela. */
function OverdueSection({ occurrences, today }: { occurrences: Occurrence<Bill>[]; today: string }) {
  const groups = new Map<string, Occurrence<Bill>[]>();
  for (const o of occurrences) groups.set(o.bill.id, [...(groups.get(o.bill.id) ?? []), o]);

  return (
    <section
      aria-labelledby="overdue-title"
      className="rounded-xl border-l-4 border-overdue bg-secondary p-4 ring-1 ring-overdue/60"
    >
      <h2 id="overdue-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
        <AlertTriangleIcon className="size-5 text-overdue-foreground" aria-hidden />
        Atrasadas
        <span className="rounded-full bg-overdue px-2 py-0.5 text-xs font-bold text-white tabular-nums">
          {occurrences.length}
        </span>
      </h2>
      <div className="mt-2 space-y-4">
        {[...groups.values()].map((items) => {
          const bill = items[0].bill;
          return (
            <div key={bill.id}>
              <h3 className="flex flex-wrap items-baseline gap-x-2 border-b border-overdue/40 pb-1 pt-2">
                <Link href={`/bills/${bill.id}`} className="font-medium underline-offset-4 hover:underline">
                  {bill.name}
                </Link>
                {items.length > 1 && (
                  <span className="text-sm text-overdue-foreground">{items.length} atrasadas</span>
                )}
              </h3>
              <ul className={cn("divide-y divide-overdue/30")}>
                {items.map((o) => (
                  <OccurrenceRow key={o.dueDate} occurrence={o} today={today} showBillName={false} showStatus={false} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
