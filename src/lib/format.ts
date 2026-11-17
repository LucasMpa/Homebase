import { diffInDays, parsePlainDate, type PlainDate } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

/** Categoria de contas e lançamentos (uma lista só). */
export type Category = Database["public"]["Enums"]["category"];

/** "2026-10-15" → "15/10/2026" */
export function formatDate(date: PlainDate): string {
  const { year, month, day } = parsePlainDate(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
/** Meses abreviados: "jan", "fev"… */
export const MONTH_ABBREVIATIONS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function weekdayName(date: PlainDate): string {
  const { year, month, day } = parsePlainDate(date);
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return WEEKDAYS[d.getUTCDay()];
}

/** Texto curto relativo a hoje: "hoje", "amanhã", "há 3 dias", "em 5 dias". */
export function relativeDay(date: PlainDate, today: PlainDate): string {
  const diff = diffInDays(today, date);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return diff < 0 ? `há ${-diff} dias` : `em ${diff} dias`;
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-15" → "outubro" */
export function monthName(date: PlainDate): string {
  return MONTH_NAMES[parsePlainDate(date).month - 1];
}

/** "2026-10" → "out/2026" */
export function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_ABBREVIATIONS[m - 1]}/${year}`;
}

/** Na ordem em que aparecem nos formulários. */
export const CATEGORY_LABELS: Record<Category, string> = {
  housing: "Moradia",
  utilities: "Contas de consumo",
  internet: "Internet e telefone",
  subscriptions: "Assinaturas",
  food: "Alimentação",
  home: "Casa e manutenção",
  health: "Saúde",
  education: "Educação",
  transportation: "Transporte",
  leisure: "Lazer",
  shopping: "Compras",
  travel: "Viagem",
  taxes: "Impostos",
  insurance: "Seguros",
  other: "Outros",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as [Category, ...Category[]];
