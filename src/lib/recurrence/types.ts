/** Data civil sem horário nem fuso, no formato ISO "YYYY-MM-DD". */
export type PlainDate = string;

export type BillFrequency = "once" | "weekly" | "monthly" | "yearly";

/** Regra de recorrência de uma conta. A âncora é sempre `startDate`. */
export interface RecurrenceRule {
  frequency: BillFrequency;
  startDate: PlainDate;
  endDate: PlainDate | null;
  /** Contas arquivadas não geram ocorrências. */
  archived: boolean;
}

export type OccurrenceStatus = "paid" | "overdue" | "due_today" | "upcoming";
