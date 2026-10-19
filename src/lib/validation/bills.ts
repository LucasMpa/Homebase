import { z } from "zod";
import { CATEGORIES } from "@/lib/format";
import { brlAmount, optionalText, plainDate } from "./common";

export const BILL_FIELDS = [
  "name",
  "category",
  "frequency",
  "startDate",
  "endDate",
  "estimatedAmount",
  "notes",
] as const;

export type BillFormValues = Record<(typeof BILL_FIELDS)[number], string>;

export const billFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da conta").max(120, "Máximo de 120 caracteres"),
    category: z.enum(CATEGORIES, { error: "Escolha a categoria" }),
    frequency: z.enum(["once", "weekly", "monthly", "yearly"], { error: "Escolha a frequência" }),
    startDate: plainDate("Informe a data do primeiro vencimento"),
    endDate: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(plainDate("Data final inválida").nullable()),
    estimatedAmount: brlAmount,
    notes: optionalText(1000),
  })
  .refine((d) => d.endDate === null || d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "A data final não pode ser anterior ao primeiro vencimento",
  });

export type BillInput = z.output<typeof billFormSchema>;
