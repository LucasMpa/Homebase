import { z } from "zod";
import { todayInSaoPaulo } from "@/lib/recurrence";
import { brlAmount, plainDate } from "./common";

export const paymentFormSchema = z.object({
  billId: z.uuid("Conta inválida"),
  dueDate: plainDate("Vencimento inválido"),
  paidAt: plainDate("Informe a data do pagamento").refine(
    (d) => d <= todayInSaoPaulo(),
    "A data do pagamento não pode ser no futuro",
  ),
  amount: brlAmount.pipe(z.number({ error: "Informe o valor pago" })),
});

export type PaymentFormValues = z.input<typeof paymentFormSchema>;
export type PaymentInput = z.output<typeof paymentFormSchema>;

export const paymentKeySchema = z.object({
  billId: z.uuid(),
  dueDate: plainDate(),
});
