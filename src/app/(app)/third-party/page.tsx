import { CalendarRangeIcon, ChevronLeftIcon, ChevronRightIcon, HandCoinsIcon, HistoryIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { ExpenseRow } from "@/components/third-party/expense-row";
import { SettleDialog } from "@/components/third-party/settle-dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatMonth } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { parseMonthParam } from "@/lib/months";
import {
  addMonths,
  groupByPerson,
  monthlyOverview,
  monthOf,
  pendingCents,
  pendingInstallments,
  type PersonGroup,
  type ThirdPartyExpense,
} from "@/lib/third-party";
import { cn } from "@/lib/utils";
import { MAX_YEAR } from "@/lib/validation/common";
import { listExpenses } from "@/server/third-party";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Gastos de terceiros" };

const OVERVIEW_MONTHS = 6;

export default async function ThirdPartyPage({ searchParams }: PageProps<"/third-party">) {
  const params = await searchParams;
  const settled = params.settled === "1";
  const [expenses, today] = await Promise.all([listExpenses({ settled }), getToday()]);
  // A receber soma só o que falta (parcelas em aberto); acertados, o valor da compra.
  const groups = settled ? groupByPerson(expenses) : groupByPerson(expenses, pendingCents);
  const currentMonth = monthOf(today);
  // Mês do card "A receber"; pode ir para o futuro, já que as parcelas vencem nos meses seguintes.
  const summaryMonth = parseMonthParam(params.month, currentMonth, `${MAX_YEAR}-12`);
  const totalCents = groups.reduce((sum, g) => sum + g.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Gastos de terceiros"
        description="O que outras pessoas passaram no seu cartão e precisam te devolver."
        actions={
          <Link href="/third-party/new" className={buttonVariants()}>
            <PlusIcon aria-hidden /> Novo gasto
          </Link>
        }
      />

      <SegmentedNav
        label="Filtro"
        items={[
          { href: "/third-party", label: "A receber", active: !settled },
          { href: "/third-party?settled=1", label: "Acertados", active: settled },
        ]}
      />

      {expenses.length === 0 ? (
        settled ? (
          <EmptyState icon={HistoryIcon} title="Nenhum gasto acertado ainda" />
        ) : (
          <EmptyState
            icon={HandCoinsIcon}
            title="Ninguém te deve nada"
            description="Cadastre aqui o que outras pessoas passarem no seu cartão."
            action={
              <Link href="/third-party/new" className={buttonVariants()}>
                <PlusIcon aria-hidden /> Cadastrar gasto
              </Link>
            }
          />
        )
      ) : (
        <>
          {settled ? (
            <section aria-label="Resumo" className="mb-8 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="text-sm text-muted-foreground">Total já recebido</p>
              <p className="mt-1 font-heading text-xl font-semibold tabular-nums md:text-2xl">{formatBRL(totalCents)}</p>
              {groups.length > 1 && <PersonBreakdown items={groups.map((g) => ({ person: g.person, cents: g.totalCents }))} />}
            </section>
          ) : (
            <PendingSummary
              expenses={expenses}
              month={summaryMonth}
              currentMonth={currentMonth}
              groups={groups}
              totalCents={totalCents}
            />
          )}

          {!settled && <MonthlyOverview expenses={expenses} currentMonth={currentMonth} />}

          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.person} aria-label={group.person}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading text-lg font-semibold">
                    {group.person}{" "}
                    <span className="text-base font-normal text-muted-foreground tabular-nums">
                      · {formatBRL(group.totalCents)}
                    </span>
                  </h2>
                  {!settled && <SettleDueDialog group={group} currentMonth={currentMonth} />}
                </div>
                <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
                  {group.expenses.map((expense) => (
                    <ExpenseRow key={expense.id} expense={expense} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/**
 * "Acertar até {mês atual}": todas as parcelas da pessoa que vencem até este mês
 * (inclusive as atrasadas). Só aparece com 2 ou mais; uma só já tem botão na linha.
 */
function SettleDueDialog({ group, currentMonth }: { group: PersonGroup; currentMonth: string }) {
  const due = group.expenses.flatMap((e) =>
    pendingInstallments(e)
      .filter((i) => i.month <= currentMonth)
      .map((i) => ({ expenseId: e.id, installment: i.number, cents: i.cents })),
  );
  if (due.length < 2) return null;
  const totalCents = due.reduce((sum, i) => sum + i.cents, 0);
  return (
    <SettleDialog
      items={due.map(({ expenseId, installment }) => ({ expenseId, installment }))}
      title={`Acertar parcelas de ${group.person}`}
      description={`${due.length} parcelas que vencem até ${formatMonth(currentMonth)} serão marcadas como acertadas.`}
      totalCents={totalCents}
      label={`Acertar até ${formatMonth(currentMonth)}`}
    />
  );
}

/** Parcelas a receber mês a mês, a partir do mês atual. */
function MonthlyOverview({ expenses, currentMonth }: { expenses: ThirdPartyExpense[]; currentMonth: string }) {
  const { before, months, after } = monthlyOverview(expenses, currentMonth, OVERVIEW_MONTHS);
  const multiplePeople = new Set(months.flatMap((m) => m.byPerson.map((p) => p.person.toLowerCase()))).size > 1;

  return (
    <section aria-labelledby="monthly-title" className="mb-8">
      <h2 id="monthly-title" className="mb-2 flex items-center gap-2 font-heading text-lg font-semibold">
        <CalendarRangeIcon className="size-5 text-primary" aria-hidden /> Por mês
      </h2>
      <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
        {before > 0 && (
          <li className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Meses anteriores (pendente)</span>
            <span className="font-semibold text-overdue-foreground tabular-nums">{formatBRL(before)}</span>
          </li>
        )}
        {months.map((m) => (
          <li key={m.month} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <span className={cn(m.month === currentMonth && "font-medium")}>
                {formatMonth(m.month)}
                {m.month === currentMonth && <span className="text-muted-foreground"> · este mês</span>}
              </span>
              {multiplePeople && m.byPerson.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {m.byPerson.map((p) => `${p.person}: ${formatBRL(p.cents)}`).join(" · ")}
                </p>
              )}
            </div>
            <span className={cn("shrink-0 font-semibold tabular-nums", m.totalCents === 0 && "font-normal text-muted-foreground")}>
              {m.totalCents === 0 ? "—" : formatBRL(m.totalCents)}
            </span>
          </li>
        ))}
        {after > 0 && (
          <li className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Depois de {formatMonth(months[months.length - 1].month)}</span>
            <span className="font-semibold tabular-nums">{formatBRL(after)}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Cards "A receber no mês" (parcelas de `month`, navegável pelas setas) e "Total a receber" (tudo pendente, com a barra do que já foi recebido). */
function PendingSummary({
  expenses,
  month,
  currentMonth,
  groups,
  totalCents,
}: {
  expenses: ThirdPartyExpense[];
  month: string;
  currentMonth: string;
  groups: PersonGroup[];
  totalCents: number;
}) {
  const { before, months } = monthlyOverview(expenses, month, 1);
  const thisMonth = months[0];
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  // O mês atual fica sem parâmetro; scroll={false} mantém a página no lugar ao trocar de mês.
  const hrefFor = (m: string) => (m === currentMonth ? "/third-party" : `/third-party?month=${m}`);
  // Barra do "Total a receber": o máximo é o valor integral dos gastos em aberto; enche com o que já foi acertado.
  const fullCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const receivedCents = fullCents - totalCents;
  const progress = fullCents > 0 ? (receivedCents / fullCents) * 100 : 0;
  const arrow = cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "size-8");

  return (
    <section aria-label="Resumo" className="mb-8 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {/* Mesma estrutura do card ao lado (rótulo, valor, dica), para os valores ficarem na mesma linha. */}
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {month === currentMonth ? "A receber este mês" : "A receber no mês"}
          </p>
          {/* -my-1.5: as setas não aumentam a altura da linha do rótulo. */}
          <nav aria-label="Mês" className="-my-1.5 -mr-1.5 flex shrink-0 items-center">
            <Link href={hrefFor(prev)} scroll={false} className={arrow} aria-label={`Mês anterior: ${formatMonth(prev)}`}>
              <ChevronLeftIcon aria-hidden />
            </Link>
            <Link href={hrefFor(next)} scroll={false} className={arrow} aria-label={`Próximo mês: ${formatMonth(next)}`}>
              <ChevronRightIcon aria-hidden />
            </Link>
          </nav>
        </div>
        <p className="mt-1 font-heading text-xl font-semibold tabular-nums md:text-2xl">{formatBRL(thisMonth.totalCents)}</p>
        <p className="mt-1 text-xs text-muted-foreground">parcelas de {formatMonth(month)}</p>
        {before > 0 && (
          <p className="mt-1 text-xs text-overdue-foreground">+ {formatBRL(before)} de meses anteriores</p>
        )}
        {thisMonth.byPerson.length > 1 && <PersonBreakdown items={thisMonth.byPerson} />}
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">Total a receber</p>
        <p className="mt-1 font-heading text-xl font-semibold text-primary tabular-nums md:text-2xl">
          {formatBRL(totalCents)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{formatBRL(receivedCents)}</span> de{" "}
          <span className="tabular-nums">{formatBRL(fullCents)}</span> já recebido
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={fullCents}
          aria-valuenow={receivedCents}
          aria-valuetext={`${formatBRL(receivedCents)} de ${formatBRL(fullCents)} recebido`}
          aria-label="Recebido dos gastos em aberto"
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted ring-1 ring-border"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        {groups.length > 1 && <PersonBreakdown items={groups.map((g) => ({ person: g.person, cents: g.totalCents }))} />}
      </div>
    </section>
  );
}

function PersonBreakdown({ items }: { items: { person: string; cents: number }[] }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {items.map((p) => `${p.person}: ${formatBRL(p.cents)}`).join(" · ")}
    </p>
  );
}
