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
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Lançamentos" };

/** Toasts das mutações que terminam em redirect para cá (src/server/transaction-actions.ts). */
const NOTICES: Record<string, string> = {
  registrado: "Gasto registrado",
  atualizado: "Gasto atualizado",
  excluido: "Gasto excluído",
};

const KINDS: { kind: LedgerKind; label: string }[] = [
  { kind: "tudo", label: "Tudo" },
  { kind: "avulsos", label: "Avulsos" },
  { kind: "contas", label: "Contas" },
];

const firstDay = (month: YearMonth) => `${month}-01`;

function monthLabel(month: YearMonth) {
  return `${monthName(firstDay(month))} de ${month.slice(0, 4)}`;
}

/** "outubro de 2026" → "Outubro de 2026" (o `capitalize` do CSS colocaria "De"). */
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default async function LedgerPage({ searchParams }: PageProps<"/lancamentos">) {
  const params = await searchParams;
  const today = await getToday();
  const currentMonth = monthOf(today);
  const month = parseMonthParam(params.mes, currentMonth, currentMonth);
  const kind = parseKindParam(params.tipo);
  const isCurrent = month === currentMonth;
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const notice = typeof params.aviso === "string" && Object.hasOwn(NOTICES, params.aviso) ? NOTICES[params.aviso] : undefined;

  // O mês atual fica sem parâmetro; o filtro de tipo acompanha a navegação de mês.
  const hrefFor = (m: YearMonth, k: LedgerKind) => {
    const query = new URLSearchParams();
    if (m !== currentMonth) query.set("mes", m);
    if (k !== "tudo") query.set("tipo", k);
    const qs = query.toString();
    return qs ? `/lancamentos?${qs}` : "/lancamentos";
  };

  const all = await listTransactions(monthBounds(month));
  const visible = filterByKind(all, kind);
  const totalCents = visible.reduce((sum, t) => sum + t.amountCents, 0);
  const { billsCents, oneOffCents } = totalsByKind(all, month, month);
  const groups = groupByDay(visible, today);
  const name = monthName(firstDay(month));

  const newButton = (
    <Link href="/lancamentos/novo" className={buttonVariants()}>
      <PlusIcon aria-hidden /> Novo gasto
    </Link>
  );

  return (
    <>
      {/* Também com valor desconhecido: o FlashToast só limpa a URL. */}
      {params.aviso !== undefined && <FlashToast message={notice} />}
      <PageHeader
        title="Lançamentos"
        description="Tudo o que saiu: contas pagas e gastos avulsos."
        actions={newButton}
      />

      <nav aria-label="Mês" className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={hrefFor(prev, kind)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label={`Mês anterior: ${monthLabel(prev)}`}
        >
          <ChevronLeftIcon aria-hidden /> <span className="capitalize">{monthName(firstDay(prev))}</span>
        </Link>
        {!isCurrent && (
          <Link
            href={hrefFor(currentMonth, kind)}
            // min-w-0: em 320px o texto quebra em duas linhas em vez de empurrar os botões para fora da tela.
            className="min-w-0 text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Voltar ao mês atual
          </Link>
        )}
        {!isCurrent && (
          <Link
            href={hrefFor(next, kind)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label={`Próximo mês: ${monthLabel(next)}`}
          >
            <span className="capitalize">{monthName(firstDay(next))}</span> <ChevronRightIcon aria-hidden />
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
            <Link href="/lancamentos/novo" className={buttonVariants()}>
              <PlusIcon aria-hidden /> Registrar gasto
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title={kind === "avulsos" ? `Nenhum gasto avulso em ${name}` : `Nenhuma conta paga em ${name}`}
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
            {kind === "tudo" && (
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                Contas {formatBRL(billsCents)} · Avulsos {formatBRL(oneOffCents)}
              </p>
            )}
          </section>

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.date} aria-labelledby={`dia-${group.date}`}>
                <h2 id={`dia-${group.date}`} className="mb-2 text-sm font-medium text-muted-foreground">
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
