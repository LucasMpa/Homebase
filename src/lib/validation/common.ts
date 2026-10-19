import { z } from "zod";
import { parseBRL } from "@/lib/money";
import { isPlainDate } from "@/lib/recurrence";

/** Limite da coluna integer do Postgres. */
export const MAX_CENTS = 2_147_483_647;

/** Faixa de anos aceita nos formulários; evita datas absurdas como 0024-03-05. */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export const plainDate = (message = "Data inválida") =>
  z
    .string()
    .trim()
    .refine(isPlainDate, message)
    .refine((d) => {
      const year = Number(d.slice(0, 4));
      return year >= MIN_YEAR && year <= MAX_YEAR;
    }, `Use um ano entre ${MIN_YEAR} e ${MAX_YEAR}`);

/** Texto do formulário → centavos (ou null se vazio). */
export const brlAmount = z.string().transform((value, ctx) => {
  const cents = parseBRL(value);
  if (cents !== null && (Number.isNaN(cents) || cents > MAX_CENTS)) {
    ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56" });
    return z.NEVER;
  }
  return cents;
});

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/** Mapa campo → primeira mensagem de erro. */
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}

/** FormData → objeto de strings (campos ausentes viram ""). */
export function formDataToStrings<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}
