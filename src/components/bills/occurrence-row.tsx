import Link from "next/link";
import { PayDialog } from "@/components/bills/pay-dialog";
import { UndoPaymentButton } from "@/components/bills/undo-payment-button";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, relativeDay, weekdayName } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import type { Occurrence, PlainDate } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import type { Bill } from "@/server/bills";

/**
 * Estreito: [info | valor] em cima, [status | ação] embaixo.
 * Largo: info | valor | status | ação, com colunas de largura fixa para o valor
 * ficar na mesma posição em todas as linhas, qualquer que seja o botão.
 */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @2xl:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_10.5rem]";

/** Uma linha de vencimento: data, conta, valor, status e ação (pagar/desfazer). */
export function OccurrenceRow({
  occurrence: { bill, dueDate, status, payment },
  today,
  showBillName = true,
  showStatus = true,
}: {
  occurrence: Occurrence<Bill>;
  today: PlainDate;
  showBillName?: boolean;
  showStatus?: boolean;
}) {
  const amount = payment?.amountCents ?? bill.estimatedAmountCents;
  return (
    // Container query: as colunas se alinham pela largura da lista, não da janela.
    <li className="@container py-3">
      <div className={ROW_GRID}>
        <div className="min-w-0">
          {showBillName && (
            <Link
              href={`/contas/${bill.id}`}
              className="block truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              {bill.name}
            </Link>
          )}
          <p className={cn("text-sm", showBillName ? "text-muted-foreground" : "text-foreground")}>
            <span className="whitespace-nowrap">
              <span className="capitalize">{weekdayName(dueDate)}</span>, {formatDate(dueDate)}
            </span>
            <span className="whitespace-nowrap text-muted-foreground"> · {relativeDay(dueDate, today)}</span>
          </p>
          {payment && <p className="text-xs text-muted-foreground">Paga em {formatDate(payment.paidAt)}</p>}
        </div>
        <span
          className={cn(
            "text-right text-sm font-semibold whitespace-nowrap tabular-nums",
            amount === null && "font-normal text-muted-foreground",
          )}
        >
          {amount === null ? "sem valor" : formatBRL(amount)}
        </span>
        <div className="flex">{showStatus && <StatusBadge status={status} />}</div>
        <div className="flex justify-end">
          {payment ? (
            <UndoPaymentButton billId={bill.id} dueDate={dueDate} />
          ) : (
            <PayDialog
              billId={bill.id}
              billName={bill.name}
              dueDate={dueDate}
              estimatedAmountCents={bill.estimatedAmountCents}
              variant={status === "upcoming" ? "outline" : "default"}
            />
          )}
        </div>
      </div>
    </li>
  );
}
