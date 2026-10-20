/** Agregações da tela de relatórios. Funções puras, sem acesso ao banco. */

import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/format";
import { monthOf, type YearMonth } from "@/lib/months";
import type { PlainDate } from "@/lib/recurrence";

/**
 * O que os relatórios precisam de um lançamento do livro-caixa. O `Transaction`
 * de src/server/transactions.ts é compatível. `billId` nulo = gasto avulso.
 */
export interface LedgerEntry {
  paidAt: PlainDate;
  amountCents: number;
  category: Category;
  billId: string | null;
}

export interface MonthTotal {
  month: YearMonth;
  cents: number;
  count: number;
}

/** Total gasto (pela data em que o dinheiro saiu) em cada um dos meses informados. */
export function paidByMonth(
  entries: readonly Pick<LedgerEntry, "paidAt" | "amountCents">[],
  months: readonly YearMonth[],
): MonthTotal[] {
  const totals = new Map(months.map((m) => [m, { month: m, cents: 0, count: 0 }]));
  for (const e of entries) {
    const entry = totals.get(monthOf(e.paidAt));
    if (!entry) continue;
    entry.cents += e.amountCents;
    entry.count++;
  }
  return months.map((m) => totals.get(m)!);
}

export interface CategoryTotal {
  /** Estável para usar como key; "outras" junta a cauda. */
  key: Category | "outras";
  label: string;
  cents: number;
}

export const OTHER_CATEGORIES = "Outras";

const inPeriod = (paidAt: PlainDate, fromMonth: YearMonth, toMonth: YearMonth) => {
  const month = monthOf(paidAt);
  return month >= fromMonth && month <= toMonth;
};

/**
 * Total gasto por categoria do lançamento no período [fromMonth, toMonth], do
 * maior para o menor (empate: ordem alfabética). Acima de `limit` categorias,
 * a cauda vira "Outras".
 */
export function paidByCategory(
  entries: readonly LedgerEntry[],
  fromMonth: YearMonth,
  toMonth: YearMonth,
  limit = CATEGORIES.length,
): CategoryTotal[] {
  const totals = new Map<Category, CategoryTotal>();
  for (const e of entries) {
    if (!inPeriod(e.paidAt, fromMonth, toMonth)) continue;
    const entry = totals.get(e.category) ?? { key: e.category, label: CATEGORY_LABELS[e.category], cents: 0 };
    entry.cents += e.amountCents;
    totals.set(e.category, entry);
  }
  const sorted = [...totals.values()].sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label, "pt-BR"));
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1).reduce((sum, c) => sum + c.cents, 0);
  return [...head, { key: "outras", label: OTHER_CATEGORIES, cents: rest }];
}

/** Divide o total do período entre pagamentos de contas e gastos avulsos. */
export function totalsByKind(
  entries: readonly LedgerEntry[],
  fromMonth: YearMonth,
  toMonth: YearMonth,
): { billsCents: number; oneOffCents: number } {
  let billsCents = 0;
  let oneOffCents = 0;
  for (const e of entries) {
    if (!inPeriod(e.paidAt, fromMonth, toMonth)) continue;
    if (e.billId === null) oneOffCents += e.amountCents;
    else billsCents += e.amountCents;
  }
  return { billsCents, oneOffCents };
}

/** Topo "redondo" para o eixo: 1, 2, 2,5 ou 5 × 10^n (em reais), em centavos. */
export function niceMax(cents: number): number {
  if (cents <= 0) return 10000;
  const amount = cents / 100;
  const magnitude = 10 ** Math.floor(Math.log10(amount));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= amount)!;
  return Math.round(step * magnitude * 100);
}
