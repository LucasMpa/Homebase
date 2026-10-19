import type { PlainDate } from "./types";

/**
 * Aritmética de datas civis ("YYYY-MM-DD"). Internamente usa UTC só como
 * calendário, então o fuso da máquina nunca interfere no resultado.
 */

export const APP_TIME_ZONE = "America/Sao_Paulo";

const PLAIN_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

export function isPlainDate(value: string): value is PlainDate {
  const match = PLAIN_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parsePlainDate(date: PlainDate): DateParts {
  const match = PLAIN_DATE_RE.exec(date);
  if (!match) throw new RangeError(`Data inválida: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatPlainDate({ year, month, day }: DateParts): PlainDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Date em UTC para uma data civil. Usa setUTCFullYear porque Date.UTC trata
 * os anos 0–99 como 1900–1999.
 */
function utcDate(year: number, monthIndex: number, day: number): Date {
  const d = new Date(0);
  d.setUTCFullYear(year, monthIndex, day);
  return d;
}

export function daysInMonth(year: number, month: number): number {
  return utcDate(year, month, 0).getUTCDate();
}

function toEpochDay(date: PlainDate): number {
  const { year, month, day } = parsePlainDate(date);
  return utcDate(year, month - 1, day).getTime() / MS_PER_DAY;
}

function fromEpochDay(epochDay: number): PlainDate {
  const d = new Date(epochDay * MS_PER_DAY);
  return formatPlainDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

export function addDays(date: PlainDate, n: number): PlainDate {
  return fromEpochDay(toEpochDay(date) + n);
}

/** Número de dias de `from` até `to` (negativo se `to` for antes). */
export function diffInDays(from: PlainDate, to: PlainDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** Datas ISO de mesmo formato comparam corretamente como strings. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function startOfMonth(date: PlainDate): PlainDate {
  const { year, month } = parsePlainDate(date);
  return formatPlainDate({ year, month, day: 1 });
}

export function endOfMonth(date: PlainDate): PlainDate {
  const { year, month } = parsePlainDate(date);
  return formatPlainDate({ year, month, day: daysInMonth(year, month) });
}

const saoPauloFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Hoje" no fuso America/Sao_Paulo para o instante `now`. */
export function todayInSaoPaulo(now: Date = new Date()): PlainDate {
  const parts = saoPauloFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return formatPlainDate({ year: get("year"), month: get("month"), day: get("day") });
}
