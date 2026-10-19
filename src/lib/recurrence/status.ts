import type { OccurrenceStatus, PlainDate } from "./types";

/** Status calculado (nunca armazenado). `today` deve vir de todayInSaoPaulo(). */
export function occurrenceStatus(dueDate: PlainDate, isPaid: boolean, today: PlainDate): OccurrenceStatus {
  if (isPaid) return "paid";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  return "upcoming";
}
