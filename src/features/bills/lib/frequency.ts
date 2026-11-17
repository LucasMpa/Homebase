/** Rótulos e descrição da frequência de uma conta. */

import type { BillFrequency } from "@/features/bills/lib/recurrence";
import { parsePlainDate, type PlainDate } from "@/lib/dates";
import { formatDate, MONTH_ABBREVIATIONS, weekdayName } from "@/lib/format";

export const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  once: "Única",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

/** "Mensal, todo dia 10", "Semanal, toda sexta"… */
export function describeFrequency(frequency: BillFrequency, startDate: PlainDate): string {
  const { month, day } = parsePlainDate(startDate);
  switch (frequency) {
    case "once":
      return `Única, em ${formatDate(startDate)}`;
    case "weekly": {
      const wd = weekdayName(startDate);
      return `Semanal, ${wd === "sábado" || wd === "domingo" ? "todo" : "toda"} ${wd}`;
    }
    case "monthly":
      return day > 28 ? `Mensal, dia ${day} (ou último dia do mês)` : `Mensal, todo dia ${day}`;
    case "yearly":
      return `Anual, todo ${day} de ${MONTH_ABBREVIATIONS[month - 1]}`;
  }
}
