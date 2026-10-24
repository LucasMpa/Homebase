import { addDays, endOfMonth, startOfMonth } from "./dates";
import { occurrencesBetween } from "./occurrences";
import { occurrenceStatus } from "./status";
import type { OccurrenceStatus, PlainDate, RecurrenceRule } from "./types";

/** Combina regras de contas com pagamentos registrados. Sem acesso ao banco. */

export interface SchedulableBill {
  id: string;
  rule: RecurrenceRule;
  estimatedAmountCents: number | null;
}

export interface PaymentRecord {
  billId: string;
  dueDate: PlainDate;
  paidAt: PlainDate;
  amountCents: number;
}

export interface Occurrence<B extends SchedulableBill = SchedulableBill> {
  bill: B;
  dueDate: PlainDate;
  status: OccurrenceStatus;
  payment: PaymentRecord | null;
}

const paymentKey = (billId: string, dueDate: PlainDate) => `${billId}|${dueDate}`;

export function indexPayments(payments: readonly PaymentRecord[]): Map<string, PaymentRecord> {
  return new Map(payments.map((p) => [paymentKey(p.billId, p.dueDate), p]));
}

/** Ocorrências de todas as contas em [from, to], ordenadas por vencimento. */
export function buildOccurrences<B extends SchedulableBill>(
  bills: readonly B[],
  payments: readonly PaymentRecord[],
  from: PlainDate,
  to: PlainDate,
  today: PlainDate,
): Occurrence<B>[] {
  const byKey = indexPayments(payments);
  const result: Occurrence<B>[] = [];
  for (const bill of bills) {
    for (const dueDate of occurrencesBetween(bill.rule, from, to)) {
      const payment = byKey.get(paymentKey(bill.id, dueDate)) ?? null;
      result.push({ bill, dueDate, payment, status: occurrenceStatus(dueDate, payment !== null, today) });
    }
  }
  return result.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

export interface WeekView<B extends SchedulableBill> {
  overdue: Occurrence<B>[];
  dueToday: Occurrence<B>[];
  /** Amanhã até hoje + 7 dias. */
  nextSevenDays: Occurrence<B>[];
}

/** Dados da tela "Esta semana". Atrasadas olham para trás até o início de cada conta. */
export function buildWeekView<B extends SchedulableBill>(
  bills: readonly B[],
  payments: readonly PaymentRecord[],
  today: PlainDate,
): WeekView<B> {
  const earliestStart = bills.reduce<PlainDate>((min, b) => (b.rule.startDate < min ? b.rule.startDate : min), today);
  const occurrences = buildOccurrences(bills, payments, earliestStart, addDays(today, 7), today);
  return {
    overdue: occurrences.filter((o) => o.status === "overdue"),
    dueToday: occurrences.filter((o) => o.status === "due_today"),
    nextSevenDays: occurrences.filter((o) => o.status === "upcoming" || (o.status === "paid" && o.dueDate > today)),
  };
}

export interface MonthSummary {
  /** Valor pago quando houver pagamento, senão o estimado. */
  expectedCents: number;
  /** Ocorrências do mês sem pagamento nem valor estimado. */
  withoutAmountCount: number;
  /** Soma dos pagamentos com data de pagamento no mês. */
  paidCents: number;
}

export function buildMonthSummary(
  bills: readonly SchedulableBill[],
  payments: readonly PaymentRecord[],
  today: PlainDate,
): MonthSummary {
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  let expectedCents = 0;
  let withoutAmountCount = 0;
  for (const o of buildOccurrences(bills, payments, from, to, today)) {
    const amount = o.payment?.amountCents ?? o.bill.estimatedAmountCents;
    if (amount === null) withoutAmountCount++;
    else expectedCents += amount;
  }
  const paidCents = payments
    .filter((p) => p.paidAt >= from && p.paidAt <= to)
    .reduce((sum, p) => sum + p.amountCents, 0);
  return { expectedCents, withoutAmountCount, paidCents };
}
