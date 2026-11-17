import type { FieldErrors } from "@/lib/validation";

/** Retorno das Server Actions que não redirecionam: sucesso, ou mensagem + erros por campo. */
export type ActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: FieldErrors };
