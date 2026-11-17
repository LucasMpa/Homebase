import { z } from "zod";
import { MAX_REPORT_MONTHS, monthSpan } from "@/features/third-party/lib/report";
import { MAX_YEAR, MIN_YEAR } from "@/lib/validation/common";

const yearMonth = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, message)
    .refine((m) => {
      const year = Number(m.slice(0, 4));
      return year >= MIN_YEAR && year <= MAX_YEAR;
    }, `Use um ano entre ${MIN_YEAR} e ${MAX_YEAR}`);

const period = {
  from: yearMonth("Mês inicial inválido"),
  to: yearMonth("Mês final inválido"),
};

function checkPeriod(value: { from: string; to: string }, ctx: z.RefinementCtx) {
  if (value.from > value.to) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "O mês final precisa ser igual ou depois do inicial" });
  } else if (monthSpan(value.from, value.to) > MAX_REPORT_MONTHS) {
    ctx.addIssue({ code: "custom", path: ["to"], message: `Escolha no máximo ${MAX_REPORT_MONTHS} meses` });
  }
}

const personName = z.string().trim().min(1, "Escolha uma pessoa").max(60, "Máximo de 60 caracteres");

/** Parâmetros do PDF autenticado (?person=&from=&to=). Pessoa vazia = todas. */
export const exportParamsSchema = z
  .object({
    person: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((v) => (v ? v : null)),
    ...period,
  })
  .superRefine(checkPeriod);

/** Link público: sempre de uma pessoa só, para não expor o que outras pessoas devem. */
export const shareLinkSchema = z.object({ person: personName, ...period }).superRefine(checkPeriod);

export type ShareLinkInput = z.output<typeof shareLinkSchema>;

/** Tokens gerados pelo app: 32 bytes em base64url. */
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
