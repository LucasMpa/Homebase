import { CalendarRangeIcon } from "lucide-react";
import { formatMonth } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { installmentSchedule, monthlyTotals, personKey, type ThirdPartyExpense } from "@/lib/third-party";

export type CommittedExpense = Pick<
  ThirdPartyExpense,
  "person" | "amountCents" | "installments" | "purchaseDate" | "settlements"
>;

const MAX_ROWS = 12;

/**
 * Prévia do custo mensal de uma compra: quanto ela soma em cada mês e quanto
 * a pessoa já tinha comprometido nesses meses com outros gastos pendentes.
 */
export function MonthlyCostPreview({
  person,
  amountCents,
  installments,
  purchaseDate,
  committed,
}: {
  person: string;
  amountCents: number;
  installments: number;
  purchaseDate: string;
  committed: CommittedExpense[];
}) {
  const schedule = installmentSchedule({ amountCents, installments, purchaseDate });
  const key = personKey(person);
  const others = key ? monthlyTotals(committed.filter((e) => personKey(e.person) === key)) : new Map<string, number>();
  const hasOthers = schedule.some((i) => (others.get(i.month) ?? 0) > 0);
  const rows = schedule.slice(0, MAX_ROWS);
  const hidden = schedule.slice(MAX_ROWS);

  const last = schedule[schedule.length - 1];
  const base = schedule.length > 1 ? schedule[1].cents : schedule[0].cents;
  const summary =
    schedule.length === 1
      ? `${formatBRL(amountCents)} em ${formatMonth(schedule[0].month)}`
      : `${formatBRL(base)} por mês, de ${formatMonth(schedule[0].month)} a ${formatMonth(last.month)}` +
        (schedule[0].cents !== base ? ` (1ª parcela de ${formatBRL(schedule[0].cents)})` : "");

  return (
    <section aria-labelledby="monthly-cost-title" className="rounded-lg bg-muted p-4 ring-1 ring-border">
      <h2 id="monthly-cost-title" className="flex items-center gap-2 text-sm font-semibold">
        <CalendarRangeIcon className="size-4 text-primary" aria-hidden /> Custo mensal
      </h2>
      <p className="mt-1 text-sm">{summary}</p>
      <p className="text-xs text-muted-foreground">
        Considerando a 1ª parcela no mês da compra
        {key ? ` e os outros gastos a receber de ${person.trim()}` : ""}.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-1.5 pr-2 text-left font-medium">Mês</th>
              {hasOthers && <th scope="col" className="px-2 py-1.5 text-right font-medium">Já comprometido</th>}
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Esta compra</th>
              {hasOthers && <th scope="col" className="py-1.5 pl-2 text-right font-medium">Total do mês</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ month, number, cents }) => {
              const before = others.get(month) ?? 0;
              return (
                <tr key={month}>
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal whitespace-nowrap">
                    {formatMonth(month)}
                    {schedule.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {number}/{schedule.length}
                      </span>
                    )}
                  </th>
                  {hasOthers && (
                    <td className="px-2 py-1.5 text-right text-muted-foreground">{before ? formatBRL(before) : "—"}</td>
                  )}
                  <td className="px-2 py-1.5 text-right">{formatBRL(cents)}</td>
                  {hasOthers && <td className="py-1.5 pl-2 text-right font-semibold">{formatBRL(before + cents)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hidden.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          + {hidden.length} {hidden.length === 1 ? "mês" : "meses"} até {formatMonth(last.month)}
        </p>
      )}
    </section>
  );
}
