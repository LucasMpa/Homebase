/** Regras puras dos gastos de terceiros (sem acesso ao banco). */

import { addMonths, monthOf, type YearMonth } from "@/lib/months";

export { addMonths, monthOf, type YearMonth };

export interface ThirdPartyExpense {
  id: string;
  person: string;
  description: string;
  amountCents: number;
  purchaseDate: string;
  installments: number;
  notes: string | null;
  /** Parcelas já acertadas (a pessoa te pagou), em qualquer ordem. */
  settlements: Settlement[];
}

export interface Settlement {
  installment: number;
  amountCents: number;
  settledAt: string;
}

export interface PersonGroup<T extends ThirdPartyExpense = ThirdPartyExpense> {
  person: string;
  totalCents: number;
  expenses: T[];
}

/** Mesmo nome com caixa ou espaços diferentes conta como a mesma pessoa. */
export function personKey(person: string): string {
  return person.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/**
 * Agrupa por pessoa, do maior total para o menor. Dentro do grupo, a compra
 * mais recente vem primeiro. O nome exibido é o do gasto mais recente.
 * `valueOf` define o que soma no total (padrão: o valor da compra).
 */
export function groupByPerson<T extends ThirdPartyExpense>(
  expenses: T[],
  valueOf: (expense: T) => number = (e) => e.amountCents,
): PersonGroup<T>[] {
  const sorted = [...expenses].sort(
    (a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || a.description.localeCompare(b.description, "pt-BR"),
  );
  const groups = new Map<string, PersonGroup<T>>();
  for (const e of sorted) {
    const key = personKey(e.person);
    const group = groups.get(key) ?? { person: e.person.trim(), totalCents: 0, expenses: [] };
    group.totalCents += valueOf(e);
    group.expenses.push(e);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.totalCents - a.totalCents || a.person.localeCompare(b.person, "pt-BR"),
  );
}

/** Valor de cada parcela, sem a sobra de centavos (que vai para a primeira; ver installmentSchedule). */
export function installmentCents(totalCents: number, installments: number): number {
  return Math.floor(totalCents / Math.max(1, installments));
}


export interface Installment {
  month: YearMonth;
  number: number;
  cents: number;
}

/**
 * Parcelas de uma compra, mês a mês. A 1ª parcela cai no mês da compra e a
 * sobra da divisão em centavos vai para ela, então a soma é sempre o total.
 */
export function installmentSchedule(
  expense: Pick<ThirdPartyExpense, "amountCents" | "installments" | "purchaseDate">,
): Installment[] {
  const n = Math.max(1, expense.installments);
  const base = installmentCents(expense.amountCents, n);
  const first = monthOf(expense.purchaseDate);
  return Array.from({ length: n }, (_, i) => ({
    month: addMonths(first, i),
    number: i + 1,
    cents: i === 0 ? expense.amountCents - base * (n - 1) : base,
  }));
}

type Schedulable = Pick<ThirdPartyExpense, "amountCents" | "installments" | "purchaseDate" | "settlements">;

/** Parcelas ainda não acertadas. */
export function pendingInstallments(expense: Schedulable): Installment[] {
  const settled = new Set(expense.settlements.map((s) => s.installment));
  return installmentSchedule(expense).filter((i) => !settled.has(i.number));
}

/** Quanto falta receber do gasto. */
export function pendingCents(expense: Schedulable): number {
  return pendingInstallments(expense).reduce((sum, i) => sum + i.cents, 0);
}

/** Acertado = todas as parcelas têm acerto. */
export function isSettled(expense: Schedulable): boolean {
  return pendingInstallments(expense).length === 0;
}

/** Dia em que o gasto ficou totalmente acertado (o último acerto), ou null se ainda há parcela pendente. */
export function settledOn(expense: Schedulable): string | null {
  if (!isSettled(expense)) return null;
  return expense.settlements.reduce<string | null>((last, s) => (last === null || s.settledAt > last ? s.settledAt : last), null);
}

/** Soma das parcelas pendentes por mês. */
export function monthlyTotals(expenses: Schedulable[]): Map<YearMonth, number> {
  const totals = new Map<YearMonth, number>();
  for (const e of expenses) {
    for (const { month, cents } of pendingInstallments(e)) totals.set(month, (totals.get(month) ?? 0) + cents);
  }
  return totals;
}

export interface MonthSummary {
  month: YearMonth;
  totalCents: number;
  byPerson: { person: string; cents: number }[];
}

/**
 * Visão mensal das parcelas pendentes: `count` meses a partir de `fromMonth`,
 * mais o que ficou pendente em meses anteriores e o que vem depois da janela.
 */
export function monthlyOverview(
  expenses: ThirdPartyExpense[],
  fromMonth: YearMonth,
  count: number,
): { before: number; months: MonthSummary[]; after: number } {
  const lastMonth = addMonths(fromMonth, count - 1);
  const months = Array.from({ length: count }, (_, i) => addMonths(fromMonth, i));
  const perMonth = new Map(months.map((m) => [m, new Map<string, { person: string; cents: number }>()]));
  let before = 0;
  let after = 0;

  for (const e of expenses) {
    const key = personKey(e.person);
    for (const { month, cents } of pendingInstallments(e)) {
      if (month < fromMonth) before += cents;
      else if (month > lastMonth) after += cents;
      else {
        const people = perMonth.get(month)!;
        const entry = people.get(key) ?? { person: e.person.trim(), cents: 0 };
        entry.cents += cents;
        people.set(key, entry);
      }
    }
  }

  return {
    before,
    after,
    months: months.map((month) => {
      const byPerson = [...perMonth.get(month)!.values()].sort((a, b) => b.cents - a.cents);
      return { month, totalCents: byPerson.reduce((s, p) => s + p.cents, 0), byPerson };
    }),
  };
}

/** Valores distintos (sem diferenciar caixa), em ordem alfabética, para sugestões do formulário. */
export function uniqueSuggestions(values: (string | null)[]): string[] {
  const byKey = new Map<string, string>();
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed && !byKey.has(personKey(trimmed))) byKey.set(personKey(trimmed), trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
