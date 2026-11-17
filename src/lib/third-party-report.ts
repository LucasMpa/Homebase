/**
 * Relatório de exportação dos gastos de terceiros (PDF e link público).
 * Regras puras: recebe os gastos e devolve as parcelas do período, mês a mês.
 */

import { formatMonth } from "@/lib/format";
import { addMonths, installmentSchedule, personKey, type ThirdPartyExpense, type YearMonth } from "@/lib/third-party";

/** Maior intervalo exportável, em meses (inclusive). */
export const MAX_REPORT_MONTHS = 24;

/** Validade de um link de compartilhamento. */
export const SHARE_TTL_DAYS = 7;

export type InstallmentStatus = "settled" | "pending" | "overdue";

export interface ReportLine {
  expenseId: string;
  person: string;
  description: string;
  purchaseDate: string;
  /** Número da parcela e total de parcelas (1/1 para compra à vista). */
  number: number;
  of: number;
  cents: number;
  status: InstallmentStatus;
  settledAt: string | null;
}

export interface ReportMonth {
  month: YearMonth;
  totalCents: number;
  settledCents: number;
  pendingCents: number;
  lines: ReportLine[];
}

export interface ExportReport {
  /** null = todas as pessoas. */
  person: string | null;
  from: YearMonth;
  to: YearMonth;
  months: ReportMonth[];
  totals: {
    totalCents: number;
    settledCents: number;
    /** Tudo o que falta receber no período (inclui o atrasado). */
    pendingCents: number;
    /** Parte do pendente que venceu antes do mês atual. */
    overdueCents: number;
  };
  /** Parcelas pendentes que vencem antes de `from` (fora do período, mas ainda em aberto). */
  earlier: { cents: number; count: number; overdue: boolean };
}

/** Parcelas pendentes antes do período, agregadas; `firstMonth` é a mais antiga (null se nenhuma). */
export interface EarlierPending {
  cents: number;
  count: number;
  firstMonth: YearMonth | null;
}

/** Quantos meses de `from` a `to`, inclusive. */
export function monthSpan(from: YearMonth, to: YearMonth): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/**
 * Parcelas de `from` a `to` (inclusive), de uma pessoa ou de todas, com o status
 * de cada uma em relação a `currentMonth`: acertada, pendente ou atrasada
 * (pendente de um mês anterior ao atual). Meses sem parcela aparecem zerados.
 */
export function buildExportReport(
  expenses: ThirdPartyExpense[],
  {
    person,
    from,
    to,
    currentMonth,
    earlierPending,
  }: {
    person: string | null;
    from: YearMonth;
    to: YearMonth;
    currentMonth: YearMonth;
    /**
     * Pendências de antes do período já somadas (link público: o banco não
     * devolve os gastos que ficam fora do período). Sem isso, calcula de `expenses`.
     */
    earlierPending?: EarlierPending;
  },
): ExportReport {
  const key = person === null ? null : personKey(person);
  const span = Math.max(0, monthSpan(from, to));
  const months: ReportMonth[] = Array.from({ length: span }, (_, i) => ({
    month: addMonths(from, i),
    totalCents: 0,
    settledCents: 0,
    pendingCents: 0,
    lines: [],
  }));
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const totals = { totalCents: 0, settledCents: 0, pendingCents: 0, overdueCents: 0 };
  const earlier = { cents: 0, count: 0, overdue: false };
  let displayPerson: string | null = null;

  for (const e of expenses) {
    if (key !== null && personKey(e.person) !== key) continue;
    displayPerson ??= e.person.trim();
    const settledBy = new Map(e.settlements.map((s) => [s.installment, s]));
    const schedule = installmentSchedule(e);

    for (const i of schedule) {
      const settlement = settledBy.get(i.number);
      if (i.month < from) {
        if (!settlement) {
          earlier.cents += i.cents;
          earlier.count += 1;
          if (i.month < currentMonth) earlier.overdue = true;
        }
        continue;
      }
      const month = byMonth.get(i.month);
      if (!month) continue;

      const status: InstallmentStatus = settlement ? "settled" : i.month < currentMonth ? "overdue" : "pending";
      month.lines.push({
        expenseId: e.id,
        person: e.person.trim(),
        description: e.description,
        purchaseDate: e.purchaseDate,
        number: i.number,
        of: schedule.length,
        cents: i.cents,
        status,
        settledAt: settlement?.settledAt ?? null,
      });
      month.totalCents += i.cents;
      totals.totalCents += i.cents;
      if (settlement) {
        month.settledCents += i.cents;
        totals.settledCents += i.cents;
      } else {
        month.pendingCents += i.cents;
        totals.pendingCents += i.cents;
        if (status === "overdue") totals.overdueCents += i.cents;
      }
    }
  }

  if (earlierPending) {
    earlier.cents = earlierPending.cents;
    earlier.count = earlierPending.count;
    earlier.overdue = earlierPending.firstMonth !== null && earlierPending.firstMonth < currentMonth;
  }

  for (const m of months) {
    m.lines.sort(
      (a, b) =>
        a.person.localeCompare(b.person, "pt-BR") ||
        a.purchaseDate.localeCompare(b.purchaseDate) ||
        a.description.localeCompare(b.description, "pt-BR") ||
        a.number - b.number,
    );
  }

  // Nome exibido: o do gasto (mantém a grafia cadastrada); sem gastos, o pedido.
  return { person: person === null ? null : (displayPerson ?? person.trim()), from, to, months, totals, earlier };
}

/** "nov/2026 a abr/2027" (ou só "nov/2026" para um mês). */
export function periodLabel(from: YearMonth, to: YearMonth): string {
  return from === to ? formatMonth(from) : `${formatMonth(from)} a ${formatMonth(to)}`;
}

/** "Ana Maria" → "ana-maria"; usado no nome do arquivo PDF. */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "todos"
  );
}

export function reportFileName(report: Pick<ExportReport, "person" | "from" | "to">): string {
  const who = report.person === null ? "todos" : slugify(report.person);
  const period = report.from === report.to ? report.from : `${report.from}-a-${report.to}`;
  return `homebase-terceiros-${who}-${period}.pdf`;
}
