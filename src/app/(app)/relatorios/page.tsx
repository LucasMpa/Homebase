import { BarChart3Icon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MonthColumns } from "@/components/reports/month-columns";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { formatMonth } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { monthBounds, monthOf, monthsEndingAt } from "@/lib/months";
import { paidByCategory, paidByMonth, totalsByKind } from "@/lib/reports";
import { hasAnyTransaction, listTransactions } from "@/server/transactions";
import { pendingCents } from "@/lib/third-party";
import { listExpenses } from "@/server/third-party";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Relatórios" };

const PERIODS = [1, 3, 6, 12] as const;
type Period = (typeof PERIODS)[number];

function resolvePeriod(param: string | string[] | undefined): Period {
  return PERIODS.find((p) => String(p) === param) ?? 1;
}

const periodLabel = (p: Period) => (p === 1 ? "1 mês" : `${p} meses`);

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const period = resolvePeriod((await searchParams).periodo);
  const today = await getToday();
  const currentMonth = monthOf(today);
  const months = monthsEndingAt(currentMonth, period);
  const first = months[0];

  // Uma leitura só do livro-caixa, limitada à janela: contas pagas (inclusive de contas arquivadas) e avulsos.
  // hasAnyTransaction: o estado vazio é só para quem nunca lançou nada, não para uma janela vazia.
  const [transactions, hasAny, thirdParty] = await Promise.all([
    listTransactions({ from: monthBounds(first).from, to: monthBounds(currentMonth).to }),
    hasAnyTransaction(),
    listExpenses(),
  ]);

  const byMonth = paidByMonth(transactions, months);
  const byCategory = paidByCategory(transactions, first, currentMonth);
  const { billsCents, oneOffCents } = totalsByKind(transactions, first, currentMonth);
  const totalSpent = byMonth.reduce((sum, m) => sum + m.cents, 0);
  // Média só dos meses fechados que tiveram lançamento, para não puxar para baixo com meses vazios ou o atual.
  const closed = byMonth.filter((m) => m.month !== currentMonth && m.count > 0);
  const average = closed.length ? Math.round(closed.reduce((s, m) => s + m.cents, 0) / closed.length) : null;
  // Recebido: parcelas acertadas no período. A receber: tudo o que ainda está em aberto.
  const receivedThirdParty = thirdParty
    .flatMap((e) => e.settlements)
    .filter((s) => monthOf(s.settledAt) >= first)
    .reduce((sum, s) => sum + s.amountCents, 0);
  const toReceive = thirdParty.reduce((sum, e) => sum + pendingCents(e), 0);
  const range = period === 1 ? formatMonth(currentMonth) : `${formatMonth(first)} a ${formatMonth(currentMonth)}`;
  const inPeriod = period === 1 ? "no mês" : `em ${periodLabel(period)}`;
  // A leitura já vem por paid_at desc, created_at desc.
  const monthTransactions = transactions.filter((t) => monthOf(t.paidAt) === currentMonth);

  const periodFilter = (
    <SegmentedNav
      label="Período"
      className="mb-6"
      items={PERIODS.map((p) => ({
        href: p === 1 ? "/relatorios" : `/relatorios?periodo=${p}`,
        label: periodLabel(p),
        active: p === period,
      }))}
    />
  );

  if (!hasAny && thirdParty.length === 0) {
    return (
      <>
        <PageHeader title="Relatórios" />
        {periodFilter}
        <EmptyState
          icon={BarChart3Icon}
          title="Ainda não há dados para mostrar"
          description="Os relatórios aparecem depois que você registrar pagamentos de contas ou gastos."
        />
      </>
    );
  }

  const maxCategory = byCategory[0]?.cents ?? 0;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={period === 1 ? `Mês atual · ${range}` : `Últimos ${periodLabel(period)} · ${range}`}
      />
      {periodFilter}

      <section aria-label="Resumo" className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Total gasto"
          value={formatBRL(totalSpent)}
          hint={`contas ${formatBRL(billsCents)} · avulsos ${formatBRL(oneOffCents)}`}
          accent
        />
        <StatTile
          label="Média mensal"
          value={average === null ? "—" : formatBRL(average)}
          hint={average === null ? "nenhum mês fechado" : `${closed.length} ${closed.length === 1 ? "mês fechado" : "meses fechados"}`}
        />
        <StatTile label="Recebido" value={formatBRL(receivedThirdParty)} hint={`de terceiros ${inPeriod}`} href="/terceiros?acertados=1" />
        <StatTile label="A receber" value={formatBRL(toReceive)} hint="de terceiros, pendente agora" href="/terceiros" />
      </section>

      <div className="space-y-8">
        <section aria-labelledby="by-month-title" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
          {period === 1 ? (
            <>
              <h2 id="by-month-title" className="font-heading text-lg font-semibold">
                Lançamentos do mês
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Pela data em que o dinheiro saiu, do mais recente para o mais antigo.
              </p>
              {monthTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {monthTransactions.map((t) => (
                    <TransactionRow key={t.id} transaction={t} showDate />
                  ))}
                </ul>
              )}
              <Link
                href={`/lancamentos?mes=${currentMonth}`}
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver todos em Lançamentos →
              </Link>
            </>
          ) : (
            <>
              <h2 id="by-month-title" className="font-heading text-lg font-semibold">
                Gastos por mês
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Pela data em que o dinheiro saiu. O mês atual aparece mais claro, ainda em andamento.
              </p>
              <MonthColumns data={byMonth} currentMonth={currentMonth} label="Total gasto por mês" />
            </>
          )}
        </section>

        <section aria-labelledby="by-category-title" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
          <h2 id="by-category-title" className="font-heading text-lg font-semibold">
            Por categoria
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Total gasto {period === 1 ? `em ${range}` : `de ${range}`}, pela categoria do lançamento.
          </p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento no período.</p>
          ) : (
            <ul className="space-y-3">
              {byCategory.map((c) => (
                <li key={c.key} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{c.label}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatBRL(c.cents)}{" "}
                      <span className="text-xs text-muted-foreground">
                        {totalSpent > 0 ? `${Math.round((c.cents / totalSpent) * 100)}%` : ""}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `max(${(c.cents / maxCategory) * 100}%, 4px)` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  /** Com href, o card inteiro vira link (ex.: "A receber" → Terceiros). */
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {/* Indica que o card é clicável; acompanha o hover do link. */}
        {href && (
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden
          />
        )}
      </div>
      <p className={`mt-1 font-heading text-lg font-semibold tabular-nums md:text-xl ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  if (!href) return <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">{content}</div>;
  return (
    <Link
      href={href}
      className="group block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {content}
    </Link>
  );
}
