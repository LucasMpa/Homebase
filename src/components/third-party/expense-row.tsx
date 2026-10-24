import { CheckIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { SettleDialog } from "@/components/third-party/settle-dialog";
import { UnsettleButton } from "@/components/third-party/unsettle-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatMonth } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { installmentCents, installmentSchedule, settledOn, type ThirdPartyExpense } from "@/lib/third-party";

/** Uma linha de gasto: descrição, data, valor, parcelas e ações (acertar/desfazer, editar). */
export function ExpenseRow({ expense, showPerson = false }: { expense: ThirdPartyExpense; showPerson?: boolean }) {
  const schedule = installmentSchedule(expense);
  const settledBy = new Map(expense.settlements.map((s) => [s.installment, s]));
  const pending = schedule.filter((i) => !settledBy.has(i.number));
  const pendingTotal = pending.reduce((sum, i) => sum + i.cents, 0);
  const settledDate = settledOn(expense);
  const single = schedule.length === 1;
  const partial = pending.length > 0 && pending.length < schedule.length;
  const label = `${expense.person} · ${expense.description}`;
  // Celular: botões de 44px (alvo de toque) dividindo a largura; com espaço, voltam ao tamanho normal.
  const touch = "h-11 @xl:h-9";

  const details = [
    showPerson && expense.person,
    formatDate(expense.purchaseDate),
    expense.installments > 1 &&
      `${expense.installments}x de ${formatBRL(installmentCents(expense.amountCents, expense.installments))}`,
  ].filter(Boolean);

  return (
    // Container query: as colunas se alinham pela largura da lista, não da janela.
    <li className="@container py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @xl:grid-cols-[minmax(0,1fr)_7.5rem_12rem]">
        <div className="min-w-0">
          <p className="truncate font-medium">{expense.description}</p>
          <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
          {settledDate && <p className="text-sm text-muted-foreground">Acertado em {formatDate(settledDate)}</p>}
          {expense.notes && <p className="mt-1 text-xs whitespace-pre-line text-muted-foreground">{expense.notes}</p>}
        </div>
        <span className="text-right text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatBRL(expense.amountCents)}
          {partial && (
            <span className="block text-sm font-normal text-muted-foreground">faltam {formatBRL(pendingTotal)}</span>
          )}
        </span>
        <div className="col-span-2 flex items-center gap-2 *:flex-1 @xl:col-span-1 @xl:justify-end @xl:*:flex-none">
          <Link
            href={`/third-party/${expense.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), touch)}
            aria-label={`Editar ${expense.description}`}
          >
            <PencilIcon aria-hidden /> Editar
          </Link>
          {single && settledDate && (
            <UnsettleButton
              items={[{ expenseId: expense.id, installment: 1 }]}
              message="Gasto voltou para “a receber”"
              ariaLabel={`Desfazer acerto de ${expense.description}`}
              className={touch}
            />
          )}
          {pending.length > 0 && (
            <SettleDialog
              items={pending.map((i) => ({ expenseId: expense.id, installment: i.number }))}
              title={single ? "Marcar como acertado" : partial ? "Acertar parcelas restantes" : "Acertar todas as parcelas"}
              description={single ? label : `${label} · ${pending.length} de ${schedule.length} parcelas`}
              totalCents={pendingTotal}
              label={single ? "Acertar" : partial ? "Acertar restante" : "Acertar tudo"}
              ariaLabel={`${single ? "Acertar" : partial ? "Acertar restante de" : "Acertar tudo de"} ${expense.description}`}
              variant="outline"
              className={touch}
            />
          )}
        </div>
      </div>

      {!single && (
        <ol aria-label={`Parcelas de ${expense.description}`} className="mt-3 divide-y divide-border/60 rounded-lg bg-muted/40 px-3">
          {schedule.map((i) => {
            const settlement = settledBy.get(i.number);
            const ref = [{ expenseId: expense.id, installment: i.number }];
            const name = `parcela ${i.number}/${schedule.length} de ${expense.description}`;
            return (
              <li key={i.number} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="tabular-nums">
                    <span className="font-medium">
                      {i.number}/{schedule.length}
                    </span>{" "}
                    <span className="text-muted-foreground">· {formatMonth(i.month)} ·</span> {formatBRL(i.cents)}
                  </p>
                  {settlement && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
                      Acertada em {formatDate(settlement.settledAt)}
                    </p>
                  )}
                </div>
                {settlement ? (
                  <UnsettleButton
                    items={ref}
                    message="Parcela voltou para “a receber”"
                    ariaLabel={`Desfazer acerto da ${name}`}
                    className={cn(touch, "shrink-0")}
                  />
                ) : (
                  <SettleDialog
                    items={ref}
                    title={`Acertar parcela ${i.number}/${schedule.length}`}
                    description={`${label} · ${formatMonth(i.month)}`}
                    totalCents={i.cents}
                    label="Acertar"
                    ariaLabel={`Acertar ${name}`}
                    variant="ghost"
                    className={cn(touch, "shrink-0")}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}
