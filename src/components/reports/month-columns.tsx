import { formatMonth, monthName } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { niceMax, type MonthTotal } from "@/lib/reports";

/**
 * Colunas mensais de uma única série (sem legenda: o título nomeia a série).
 * Tooltip por coluna no hover e no foco do teclado; tabela equivalente abaixo.
 */
export function MonthColumns({
  data,
  currentMonth,
  label,
}: {
  data: MonthTotal[];
  currentMonth: string;
  label: string;
}) {
  const max = niceMax(Math.max(...data.map((d) => d.cents)));
  const ticks = [max, max / 2, 0];

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        {/* Eixo y: 3 marcas, recessivo */}
        <div className="relative h-48 w-16 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
              {formatBRL(t).replace(/,00$/, "")}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden>
            {ticks.map((t, i) => (
              <div
                key={t}
                className={i === 2 ? "absolute inset-x-0 border-t border-border" : "absolute inset-x-0 border-t border-border/40"}
                style={{ top: `${(i / 2) * 100}%` }}
              />
            ))}
          </div>

          <ol className="relative flex h-48 items-end gap-0.5" aria-label={label}>
            {data.map((d) => {
              const pct = (d.cents / max) * 100;
              const current = d.month === currentMonth;
              const full = `${monthName(`${d.month}-01`)} de ${d.month.slice(0, 4)}`;
              const description = `${full}: ${formatBRL(d.cents)}${current ? " (mês em andamento)" : ""}`;
              return (
                <li
                  key={d.month}
                  tabIndex={0}
                  aria-label={description}
                  className="group relative flex h-full flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {/* Área de hover = coluna inteira; a barra é só a marca */}
                  <div
                    className={
                      current
                        ? "w-full max-w-8 rounded-t-[4px] bg-primary/55 transition-colors group-hover:bg-primary/75"
                        : "w-full max-w-8 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-85"
                    }
                    style={{ height: d.cents > 0 ? `max(${pct}%, 2px)` : 0 }}
                  />
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-48 rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg ring-1 ring-border group-hover:block group-focus-visible:block"
                  >
                    <p className="font-medium capitalize">{full}</p>
                    <p className="tabular-nums">{formatBRL(d.cents)}</p>
                    <p className="text-muted-foreground">
                      {d.count} {d.count === 1 ? "lançamento" : "lançamentos"}
                      {current && " · em andamento"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Eixo x: com mais de 6 meses, no celular, um rótulo sim, outro não */}
          <ol className="mt-1.5 flex gap-0.5 text-[11px] text-muted-foreground" aria-hidden>
            {data.map((d, i) => (
              <li
                key={d.month}
                className={
                  (data.length <= 6 || i % 2 === (data.length - 1) % 2 ? "" : "invisible sm:visible ") +
                  "flex-1 text-center whitespace-nowrap" +
                  (d.month === currentMonth ? " font-medium text-foreground" : "")
                }
              >
                {formatMonth(d.month).split("/")[0]}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver como tabela</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-1.5 text-left font-medium">Mês</th>
              <th scope="col" className="py-1.5 text-right font-medium">Lançamentos</th>
              <th scope="col" className="py-1.5 text-right font-medium">Total gasto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...data].reverse().map((d) => (
              <tr key={d.month}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  {formatMonth(d.month)}
                  {d.month === currentMonth && <span className="text-muted-foreground"> · em andamento</span>}
                </th>
                <td className="py-1.5 text-right text-muted-foreground">{d.count}</td>
                <td className="py-1.5 text-right">{formatBRL(d.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
