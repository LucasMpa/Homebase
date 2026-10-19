import { z } from "zod";
import { todayInSaoPaulo } from "@/lib/recurrence";
import { brlAmount, optionalText, plainDate } from "./common";

export const MAX_INSTALLMENTS = 48;

export const EXPENSE_FIELDS = ["person", "description", "amount", "purchaseDate", "installments", "notes"] as const;

export type ExpenseFormValues = Record<(typeof EXPENSE_FIELDS)[number], string>;

export const expenseFormSchema = z.object({
  person: z.string().trim().min(1, "Informe quem fez o gasto").max(60, "Máximo de 60 caracteres"),
  description: z.string().trim().min(1, "Informe o que foi comprado").max(120, "Máximo de 120 caracteres"),
  amount: brlAmount.pipe(
    z.number({ error: "Informe o valor da compra" }).int().positive("O valor precisa ser maior que zero"),
  ),
  purchaseDate: plainDate("Informe a data da compra"),
  installments: z
    .string()
    .trim()
    .transform((v) => (v === "" ? 1 : Number(v)))
    .pipe(
      z
        .number({ error: "Número de parcelas inválido" })
        .int("Número de parcelas inválido")
        .min(1, "Mínimo de 1 parcela")
        .max(MAX_INSTALLMENTS, `Máximo de ${MAX_INSTALLMENTS} parcelas`),
    ),
  notes: optionalText(1000),
});

export type ExpenseInput = z.output<typeof expenseFormSchema>;

/** Uma parcela de um gasto: o par que identifica um acerto. */
export const installmentRefSchema = z.object({
  expenseId: z.uuid(),
  installment: z.number().int().min(1).max(MAX_INSTALLMENTS),
});

export type InstallmentRef = z.infer<typeof installmentRefSchema>;

const installmentRefs = z.array(installmentRefSchema).min(1, "Nenhuma parcela selecionada").max(500);

export const settleSchema = z.object({
  items: installmentRefs,
  settledAt: plainDate("Informe a data do acerto").refine(
    (d) => d <= todayInSaoPaulo(),
    "A data do acerto não pode ser no futuro",
  ),
});

export const unsettleSchema = installmentRefs;
