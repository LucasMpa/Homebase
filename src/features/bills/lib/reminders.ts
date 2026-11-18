/**
 * Avisos de vencimento por e-mail: quais vencimentos entram no resumo de hoje.
 * Regras puras, sem acesso ao banco; o job diário busca os dados e grava o que
 * foi enviado (bill_notifications), e esta função decide o que falta avisar.
 *
 * - Vencendo: avisa com 7, 3 e 1 dia de antecedência e no próprio dia, uma vez
 *   cada. Se o job não rodar no dia exato, aquele aviso é pulado (o próximo cobre).
 * - Atrasada: avisa no 1º dia de atraso e repete a cada 7 dias até o pagamento.
 *   A repetição conta a partir do último aviso enviado, então um dia sem job não
 *   faz perder o aviso: ele sai no dia seguinte.
 * - Só olha atrasos dos últimos OVERDUE_LOOKBACK_DAYS dias.
 */

import { addDays, diffInDays, type PlainDate } from "@/lib/dates";
import { buildOccurrences, type PaymentRecord, type SchedulableBill } from "./recurrence";

/** Dias de antecedência com aviso (0 = vence hoje). */
export const UPCOMING_REMINDER_DAYS = [7, 3, 1, 0] as const;
/** Intervalo entre avisos de uma mesma parcela atrasada. */
export const OVERDUE_REPEAT_DAYS = 7;
/** Atrasos mais antigos que isso não geram e-mail (continuam na tela de contas). */
export const OVERDUE_LOOKBACK_DAYS = 60;

export type ReminderKind = "due_in_7" | "due_in_3" | "due_in_1" | "due_today" | "overdue";

/** Ordem de urgência no resumo: atrasadas primeiro, depois o que vence mais cedo. */
export const REMINDER_KIND_ORDER: readonly ReminderKind[] = ["overdue", "due_today", "due_in_1", "due_in_3", "due_in_7"];

const KIND_BY_DAYS: Record<(typeof UPCOMING_REMINDER_DAYS)[number], ReminderKind> = {
  7: "due_in_7",
  3: "due_in_3",
  1: "due_in_1",
  0: "due_today",
};

/** Um aviso já enviado (linha de bill_notifications). */
export interface SentReminder {
  billId: string;
  dueDate: PlainDate;
  kind: ReminderKind;
  sentOn: PlainDate;
}

export type ReminderBill = SchedulableBill & { name: string };

export interface Reminder<B extends ReminderBill = ReminderBill> {
  bill: B;
  dueDate: PlainDate;
  kind: ReminderKind;
  /** Dias até o vencimento (0 = hoje) ou, se atrasada, dias de atraso (≥ 1). */
  days: number;
}

/** Janela de vencimentos que o job precisa buscar para decidir os avisos de `today`. */
export function reminderWindow(today: PlainDate): { from: PlainDate; to: PlainDate } {
  return { from: addDays(today, -OVERDUE_LOOKBACK_DAYS), to: addDays(today, Math.max(...UPCOMING_REMINDER_DAYS)) };
}

/** Avisos que devem sair hoje, já sem os que foram enviados, em ordem de urgência. */
export function dueReminders<B extends ReminderBill>(
  bills: readonly B[],
  payments: readonly PaymentRecord[],
  sent: readonly SentReminder[],
  today: PlainDate,
): Reminder<B>[] {
  const { from, to } = reminderWindow(today);
  const key = (billId: string, dueDate: PlainDate, kind: ReminderKind) => `${billId}|${dueDate}|${kind}`;
  const sentKeys = new Set(sent.map((s) => key(s.billId, s.dueDate, s.kind)));
  // Último aviso de atraso de cada parcela.
  const lastOverdue = new Map<string, PlainDate>();
  for (const s of sent) {
    if (s.kind !== "overdue") continue;
    const k = `${s.billId}|${s.dueDate}`;
    const prev = lastOverdue.get(k);
    if (!prev || s.sentOn > prev) lastOverdue.set(k, s.sentOn);
  }

  const reminders: Reminder<B>[] = [];
  for (const occ of buildOccurrences(bills, payments, from, to, today)) {
    if (occ.payment) continue;
    const until = diffInDays(today, occ.dueDate);

    if (until >= 0) {
      const kind = KIND_BY_DAYS[until as keyof typeof KIND_BY_DAYS];
      if (kind && !sentKeys.has(key(occ.bill.id, occ.dueDate, kind))) {
        reminders.push({ bill: occ.bill, dueDate: occ.dueDate, kind, days: until });
      }
      continue;
    }

    const last = lastOverdue.get(`${occ.bill.id}|${occ.dueDate}`);
    if (!last || diffInDays(last, today) >= OVERDUE_REPEAT_DAYS) {
      reminders.push({ bill: occ.bill, dueDate: occ.dueDate, kind: "overdue", days: -until });
    }
  }

  return reminders.sort(
    (a, b) =>
      REMINDER_KIND_ORDER.indexOf(a.kind) - REMINDER_KIND_ORDER.indexOf(b.kind) ||
      a.dueDate.localeCompare(b.dueDate) ||
      a.bill.name.localeCompare(b.bill.name, "pt-BR"),
  );
}

/** Linhas a gravar em bill_notifications depois do envio do resumo de `today`. */
export function sentRecords(reminders: readonly Reminder[], today: PlainDate): SentReminder[] {
  return reminders.map((r) => ({ billId: r.bill.id, dueDate: r.dueDate, kind: r.kind, sentOn: today }));
}
