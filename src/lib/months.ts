import { daysInMonth, formatPlainDate, type PlainDate } from "@/lib/recurrence";
import { MAX_YEAR, MIN_YEAR } from "@/lib/validation/common";

/** Mês civil no formato "YYYY-MM". */
export type YearMonth = string;

export function monthOf(date: string): YearMonth {
  return date.slice(0, 7);
}

export function addMonths(month: YearMonth, n: number): YearMonth {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** `count` meses terminando em `last` (inclusive), do mais antigo para o mais recente. */
export function monthsEndingAt(last: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
}

const MONTH_PARAM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * "?mes=2026-09" → "2026-09". Ausente, repetido, malformado, fora de
 * [MIN_YEAR, MAX_YEAR] ou depois de `max` → `fallback`.
 */
export function parseMonthParam(
  param: string | string[] | undefined,
  fallback: YearMonth,
  max: YearMonth,
): YearMonth {
  if (typeof param !== "string" || !MONTH_PARAM_RE.test(param)) return fallback;
  const year = Number(param.slice(0, 4));
  if (year < MIN_YEAR || year > MAX_YEAR || param > max) return fallback;
  return param;
}

/** Primeiro e último dia do mês: "2026-02" → { from: "2026-02-01", to: "2026-02-28" }. */
export function monthBounds(month: YearMonth): { from: PlainDate; to: PlainDate } {
  const [year, m] = month.split("-").map(Number);
  return {
    from: formatPlainDate({ year, month: m, day: 1 }),
    to: formatPlainDate({ year, month: m, day: daysInMonth(year, m) }),
  };
}
