import { addDays, daysInMonth, diffInDays, formatPlainDate, parsePlainDate } from "./dates";
import type { PlainDate, RecurrenceRule } from "./types";

/**
 * A k-ésima ocorrência (k = 0 é `startDate`). Sempre derivada da âncora,
 * nunca da ocorrência anterior, para que o dia 31 volte a ser 31 após fevereiro.
 * Retorna null quando a frequência não tem a k-ésima ocorrência (`once`, k > 0).
 */
function nthOccurrence(rule: RecurrenceRule, k: number): PlainDate | null {
  const anchor = parsePlainDate(rule.startDate);
  switch (rule.frequency) {
    case "once":
      return k === 0 ? rule.startDate : null;
    case "weekly":
      return addDays(rule.startDate, 7 * k);
    case "monthly": {
      const monthIndex = anchor.month - 1 + k;
      const year = anchor.year + Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      return formatPlainDate({ year, month, day: Math.min(anchor.day, daysInMonth(year, month)) });
    }
    case "yearly": {
      const year = anchor.year + k;
      return formatPlainDate({ year, month: anchor.month, day: Math.min(anchor.day, daysInMonth(year, anchor.month)) });
    }
  }
}

/**
 * Um índice k cuja ocorrência é <= `from` (ou 0). Evita percorrer a série
 * inteira desde `startDate` quando o intervalo pedido está longe da âncora.
 */
function startIndexNear(rule: RecurrenceRule, from: PlainDate): number {
  if (from <= rule.startDate) return 0;
  const anchor = parsePlainDate(rule.startDate);
  const target = parsePlainDate(from);
  switch (rule.frequency) {
    case "once":
      return 0;
    case "weekly":
      return Math.floor(diffInDays(rule.startDate, from) / 7);
    case "monthly":
      return Math.max(0, (target.year - anchor.year) * 12 + (target.month - anchor.month) - 1);
    case "yearly":
      return Math.max(0, target.year - anchor.year - 1);
  }
}

function* occurrencesFrom(rule: RecurrenceRule, from: PlainDate): Generator<PlainDate> {
  if (rule.archived) return;
  for (let k = startIndexNear(rule, from); ; k++) {
    const date = nthOccurrence(rule, k);
    if (date === null) return;
    if (rule.endDate !== null && date > rule.endDate) return;
    if (date >= from) yield date;
  }
}

/** Ocorrências em [from, to], inclusivo, em ordem crescente. */
export function occurrencesBetween(rule: RecurrenceRule, from: PlainDate, to: PlainDate): PlainDate[] {
  const result: PlainDate[] = [];
  if (from > to) return result;
  for (const date of occurrencesFrom(rule, from)) {
    if (date > to) break;
    result.push(date);
  }
  return result;
}

/** As primeiras `count` ocorrências com data >= `from`. */
export function nextOccurrences(rule: RecurrenceRule, from: PlainDate, count: number): PlainDate[] {
  const result: PlainDate[] = [];
  if (count <= 0) return result;
  for (const date of occurrencesFrom(rule, from)) {
    result.push(date);
    if (result.length >= count) break;
  }
  return result;
}
