"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { SHARE_TTL_DAYS } from "@/lib/third-party-report";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import { shareLinkSchema } from "@/lib/validation/third-party-export";
import type { ActionResult } from "@/server/action-result";

export type CreateShareResult =
  | { ok: true; path: string; expiresAt: string }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

/**
 * Cria um link público para o resumo de uma pessoa no período. O token só é
 * devolvido aqui (vai na URL); no banco fica apenas o hash SHA-256.
 */
export async function createShareLink(input: { person: string; from: string; to: string }): Promise<CreateShareResult> {
  const { supabase } = await requireUser();
  const parsed = shareLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Confira os campos.", fieldErrors: fieldErrorsOf(parsed.error) };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("third_party_shares").insert({
    token_hash: createHash("sha256").update(token).digest("hex"),
    person: parsed.data.person,
    from_month: parsed.data.from,
    to_month: parsed.data.to,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, message: "Não foi possível gerar o link. Tente novamente." };

  revalidatePath("/third-party");
  return { ok: true, path: `/share/${token}`, expiresAt };
}

/** Revoga um link: ele para de funcionar na hora. */
export async function revokeShareLink(shareId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(shareId).success) return { ok: false, message: "Link inválido." };
  const { error, count } = await supabase
    .from("third_party_shares")
    .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", shareId)
    .is("revoked_at", null);
  if (error || count !== 1) return { ok: false, message: "Não foi possível revogar o link." };
  revalidatePath("/third-party");
  return { ok: true };
}
