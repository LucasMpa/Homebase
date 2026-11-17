import { CheckIcon, DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMonth } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { todayInSaoPaulo } from "@/lib/dates";
import { monthOf } from "@/lib/third-party";
import { buildExportReport, periodLabel, type ReportLine } from "@/lib/third-party-report";
import { cn } from "@/lib/utils";
import { getSharedReport } from "@/server/third-party-shares";
import { getToday } from "@/server/today";

/*
 * Página pública (sem login) de um link de compartilhamento: o resumo mensal das
 * parcelas de uma pessoa. Os dados são lidos a cada acesso (sempre atualizados).
 * Sem nenhum link para o resto do app; noindex e no-referrer vêm do next.config.ts.
 */

export async function generateMetadata({ params }: PageProps<"/share/[token]">): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedReport(token);
  return {
    title: shared ? `Resumo de ${shared.person}` : "Link não encontrado",
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const [shared, today] = await Promise.all([getSharedReport(token), getToday()]);
  if (!shared) notFound();

  const currentMonth = monthOf(today);
  const report = buildExportReport(shared.expenses, {
    person: shared.person,
    from: shared.from,
    to: shared.to,
    currentMonth,
    earlierPending: shared.earlierPending,
  });
  const period = periodLabel(report.from, report.to);
  const { totals } = report;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Logo />
        <a href={`/share/${token}/pdf`} className={buttonVariants({ variant: "outline" })} download>
          <DownloadIcon aria-hidden /> Baixar PDF
        </a>
      </header>

      <main>
        {/* Centralizado no celular; alinhado à esquerda a partir do md. */}
        <div className="text-center md:text-left">
          <p className="text-sm text-muted-foreground">Resumo de gastos de terceiros</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight md:text-3xl">{report.person}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Parcelas de {period}</p>
        </div>

        {/* Celular: cards em largura total, empilhados e centralizados. A partir do md: lado a lado, à esquerda. */}
        <section aria-label="Totais" className="mt-6 mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
          <SummaryCard label="Total no período" cents={totals.totalCents} />
          {totals.overdueCents > 0 && (
            <SummaryCard label="Atrasado" cents={totals.overdueCents} className="text-overdue-foreground" />
          )}
        </section>

        {report.earlier.cents > 0 && (
          <p
            className={cn(
              "mb-8 rounded-lg bg-muted p-3 text-sm ring-1 ring-border",
              report.earlier.overdue ? "text-overdue-foreground" : "text-muted-foreground",
            )}
          >
            + {formatBRL(report.earlier.cents)} pendente de antes de {formatMonth(report.from)} ({report.earlier.count}{" "}
            {report.earlier.count === 1 ? "parcela" : "parcelas"}), fora deste resumo.
          </p>
        )}

        <div className="space-y-6">
          {report.months.map((m) => (
            <section key={m.month} aria-labelledby={`month-${m.month}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 id={`month-${m.month}`} className="font-heading text-lg font-semibold">
                  {formatMonth(m.month)}
                  {m.month === currentMonth && <span className="text-base font-normal text-muted-foreground"> · este mês</span>}
                </h2>
                {m.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma parcela</p>
                ) : (
                  <p className="text-sm font-semibold tabular-nums">{formatBRL(m.totalCents)}</p>
                )}
              </div>
              {m.lines.length > 0 && (
                <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-foreground/10">
                  {m.lines.map((line) => (
                    <Line key={`${line.expenseId}-${line.number}`} line={line} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        Valores atualizados a cada acesso · Link válido até {formatDate(todayInSaoPaulo(new Date(shared.expiresAt)))}
      </footer>
    </div>
  );
}

function SummaryCard({ label, cents, className }: { label: string; cents: number; className?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-card p-4 text-center ring-1 ring-foreground/10 md:items-start md:text-left">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-xl font-semibold tabular-nums md:text-2xl", className)}>{formatBRL(cents)}</p>
    </div>
  );
}

function Line({ line }: { line: ReportLine }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{line.description}</p>
        <p className="text-sm text-muted-foreground">
          Compra em {formatDate(line.purchaseDate)} · {line.of > 1 ? `Parcela ${line.number}/${line.of}` : "À vista"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatBRL(line.cents)}</p>
        {line.status === "settled" ? (
          <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <CheckIcon className="size-3.5 text-primary" aria-hidden /> Acertada em {formatDate(line.settledAt!)}
          </p>
        ) : (
          line.status === "overdue" && <p className="text-xs font-medium text-overdue-foreground">Atrasada</p>
        )}
      </div>
    </li>
  );
}
