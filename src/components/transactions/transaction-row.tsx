import { ChevronRightIcon, ReceiptTextIcon } from "lucide-react";
import Link from "next/link";
import { CATEGORY_LABELS, formatDate } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import type { Transaction } from "@/server/transactions";

/**
 * Uma linha do livro-caixa; a linha inteira é o link. Pagamento de conta leva
 * à conta (só muda por lá) e traz a etiqueta "Conta"; gasto avulso leva à edição.
 * O nome acessível é o próprio texto visível, mais a ação em sr-only.
 */
export function TransactionRow({ transaction: t, showDate = false }: { transaction: Transaction; showDate?: boolean }) {
  const isBill = t.billId !== null;
  const href = isBill ? `/bills/${t.billId}` : `/transactions/${t.id}/edit`;

  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-3 outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">{t.description}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {isBill && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-foreground ring-1 ring-border">
                <ReceiptTextIcon className="size-3" aria-hidden /> Conta
              </span>
            )}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              {CATEGORY_LABELS[t.category]}
            </span>
            {showDate && <span>Pago em {formatDate(t.paidAt)}</span>}
            {isBill && <span>Vencimento {formatDate(t.dueDate!)}</span>}
          </div>
          {t.notes && <p className="line-clamp-1 text-xs text-muted-foreground">{t.notes}</p>}
        </div>
        <span className="shrink-0 text-right text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatBRL(t.amountCents)}
        </span>
        <span className="sr-only">{isBill ? ", ver conta" : ", editar gasto"}</span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
