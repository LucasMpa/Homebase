/** Regras da tela de Lançamentos (livro-caixa). Funções puras, sem acesso ao banco. */

import { formatDate, weekdayName } from "@/lib/format";
import { addDays, type PlainDate } from "@/lib/recurrence";

/** Filtro de tipo: "?kind=one-off" / "?kind=bills"; sem parâmetro = tudo. */
export type LedgerKind = "all" | "one-off" | "bills";

export function parseKindParam(param: string | string[] | undefined): LedgerKind {
  return param === "one-off" || param === "bills" ? param : "all";
}

export function filterByKind<T extends { billId: string | null }>(entries: readonly T[], kind: LedgerKind): T[] {
  if (kind === "all") return [...entries];
  return entries.filter((e) => (kind === "bills" ? e.billId !== null : e.billId === null));
}

/** Cabeçalho do dia: "Hoje", "Ontem" ou "sexta, 16/10". */
export function dayLabel(date: PlainDate, today: PlainDate): string {
  if (date === today) return "Hoje";
  if (date === addDays(today, -1)) return "Ontem";
  return `${weekdayName(date)}, ${formatDate(date).slice(0, 5)}`;
}

export interface DayGroup<T> {
  date: PlainDate;
  label: string;
  items: T[];
}

/**
 * Agrupa por `paidAt`, do dia mais recente para o mais antigo. Dentro do dia
 * mantém a ordem recebida (a leitura já vem por created_at desc).
 */
export function groupByDay<T extends { paidAt: PlainDate }>(entries: readonly T[], today: PlainDate): DayGroup<T>[] {
  const groups = new Map<PlainDate, DayGroup<T>>();
  for (const e of entries) {
    const group = groups.get(e.paidAt) ?? { date: e.paidAt, label: dayLabel(e.paidAt, today), items: [] };
    group.items.push(e);
    groups.set(e.paidAt, group);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export const BILL_PAYMENT_LOCKED_MESSAGE = "Este lançamento é o pagamento de uma conta. Altere-o pela conta.";

/**
 * Pagamento de conta só muda pela conta (marcar como paga / desfazer).
 * Retorna o motivo da recusa, ou null se o lançamento é avulso e pode ser editado/excluído.
 */
export function editLockReason(entry: { billId: string | null }): string | null {
  return entry.billId === null ? null : BILL_PAYMENT_LOCKED_MESSAGE;
}
