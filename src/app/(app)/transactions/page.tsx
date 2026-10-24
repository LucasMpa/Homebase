import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import { PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { buttonVariants } from "@/components/ui/button";
import { monthName } from "@/lib/format";
import { filterByKind, groupByDay, parseKindParam, type LedgerKind } from "@/lib/ledger";
import { formatBRL } from "@/lib/money";
import { addMonths, monthBounds, monthOf, parseMonthParam, type YearMonth } from "@/lib/months";
import { totalsByKind } from "@/lib/reports";
import { listTransactions } from "@/server/transactions";
import { cn } from "@/lib/utils";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Lançamentos" };

/** Toasts das mutações que terminam em redirect para cá (src/server/transaction-actions.ts). */
const NOTICES: Record<string, string> = {
  created: "Gasto registrado",
  updated: "Gasto atualizado",
  deleted: "Gasto excluído",
};

const KINDS: { kind: LedgerKind; label: string }[] = [
  { kind: "all", label: "Tudo" },
  { kind: "one-off", label: "Avulsos" },
  { kind: "bills", label: "Contas" },
];

const firstDay = (month: YearMonth) => `${month}-01`;

function monthLabel(month: YearMonth) {
  return `${monthName(firstDay(month))} de ${month.slice(0, 4)}`;
}

/** "outubro de 2026" → "Outubro de 2026" (o `capitalize` do CSS colocaria "De"). */
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default async function LedgerPage({ searchParams }: PageProps<"/transactions">) {
  const params = await searchParams;
  const today = await getToday();
  const currentMonth = monthOf(today);
  const month = parseMonthParam(params.month, currentMonth, currentMonth);
  const kind = parseKindParam(params.kind);
  const isCurrent = month === currentMonth;
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const notice = typeof params.notice === "string" && Object.hasOwn(NOTICES, params.notice) ? NOTICES[params.notice] : undefined;

  // O mês atual fica sem parâmetro; o filtro de tipo acompanha a navegação de mês.
  const hrefFor = (m: YearMonth, k: LedgerKind) => {
    const query = new URLSearchParams();
    if (m !== currentMonth) query.set("month", m);
    if (k !== "all") query.set("kind", k);
    const qs = query.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  };

  const all = await listTransactions(monthBounds(month));
  const visible = filterByKind(all, kind);
  const totalCents = visible.reduce((sum, t) => sum + t.amountCents, 0);
  const { billsCents, oneOffCents } = totalsByKind(all, month, month);
  const groups = groupByDay(visible, today);
  const name = monthName(firstDay(month));

  // No celular o cabeçalho fixo já tem "+ Gasto"; aqui o botão só aparece a partir do md.
  const newButton = (
    <Link href="/transactions/new" className={cn(buttonVariants(), "hidden md:inline-flex")}>
      <PlusIcon aria-hidden /> Novo gasto
    </Link>
  );

  return (
    <>
      {/* Também com valor desconhecido: o FlashToast só limpa a URL. */}
      {params.notice !== undefined && <FlashToast message={notice} />}
      <PageHeader
        title="Lançamentos"
        description="Tudo o que saiu: contas pagas e gastos avulsos."
        actions={newButton}
      />

      {/* Seletor de mês: setas de 44px nas pontas e o mês visível no meio, que é o que importa no celular. */}
      <nav aria-label="Mês" className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-card p-1 ring-1 ring-foreground/10">
        <Link
          href={hrefFor(prev, kind)}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11")}
          aria-label={`Mês anterior: ${monthLabel(prev)}`}
        >
          <ChevronLeftIcon className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 text-center">
          <p className="truncate font-heading font-semibold">
            {upperFirst(monthLabel(month))}
          </p>
          {isCurrent ? (
            <p className="text-xs text-muted-foreground">mês atual</p>
          ) : (
            <Link
              href={hrefFor(currentMonth, kind)}
              className="text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              Voltar ao mês atual
            </Link>
          )}
        </div>
        {isCurrent ? (
          // Mesmo espaço da seta, para o mês continuar centralizado; não há mês futuro com lançamentos.
          <span className="size-11 shrink-0" aria-hidden />
        ) : (
          <Link
            href={hrefFor(next, kind)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11")}
            aria-label={`Próximo mês: ${monthLabel(next)}`}
          >
            <ChevronRightIcon className="size-5" aria-hidden />
          </Link>
        )}
      </nav>

      <SegmentedNav
        label="Tipo de lançamento"
        className="mb-6"
        items={KINDS.map((k) => ({ href: hrefFor(month, k.kind), label: k.label, active: k.kind === kind }))}
      />

      {all.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title={`Nenhum lançamento em ${name}`}
          action={
            <Link href="/transactions/new" className={buttonVariants()}>
              <PlusIcon aria-hidden /> Registrar gasto
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title={kind === "one-off" ? `Nenhum gasto avulso em ${name}` : `Nenhuma conta paga em ${name}`}
        />
      ) : (
        <>
          <section aria-label={`Total de ${monthLabel(month)}`} className="mb-8 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-sm text-muted-foreground">Total do mês</p>
            <p className="mt-1 font-heading text-xl font-semibold text-primary tabular-nums md:text-2xl">
              {formatBRL(totalCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {upperFirst(monthLabel(month))} · {visible.length} {visible.length === 1 ? "lançamento" : "lançamentos"}
            </p>
            {kind === "all" && (
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                Contas {formatBRL(billsCents)} · Avulsos {formatBRL(oneOffCents)}
              </p>
            )}
          </section>

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.date} aria-labelledby={`day-${group.date}`}>
                <h2 id={`day-${group.date}`} className="mb-2 text-sm font-medium text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
                  {group.items.map((t) => (
                    <TransactionRow key={t.id} transaction={t} />
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
