import { z } from "zod";
import { CATEGORIES } from "@/lib/format";
import { todayInSaoPaulo } from "@/lib/recurrence";
import { brlAmount, optionalText, plainDate } from "./common";

/** Formulário de gasto avulso (lançamento sem conta). */
export const TRANSACTION_FIELDS = ["description", "amount", "paidAt", "category", "notes"] as const;

export type TransactionFormValues = Record<(typeof TRANSACTION_FIELDS)[number], string>;

export const transactionFormSchema = z.object({
  description: z.string().trim().min(1, "Informe o que foi pago").max(120, "Máximo de 120 caracteres"),
  amount: brlAmount.pipe(
    z.number({ error: "Informe o valor" }).int().positive("O valor precisa ser maior que zero"),
  ),
  paidAt: plainDate("Informe a data").refine((d) => d <= todayInSaoPaulo(), "A data não pode ser no futuro"),
  category: z.enum(CATEGORIES, { error: "Escolha a categoria" }),
  notes: optionalText(1000),
});

export type TransactionInput = z.output<typeof transactionFormSchema>;
