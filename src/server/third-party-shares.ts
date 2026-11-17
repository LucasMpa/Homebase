import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { ThirdPartyExpense } from "@/lib/third-party";
import type { EarlierPending } from "@/lib/third-party-report";
import { shareTokenSchema } from "@/lib/validation/third-party-export";

export interface ShareSummary {
  id: string;
  person: string;
  from: string;
  to: string;
  expiresAt: string;
  createdAt: string;
}

/** Links ainda válidos (nem revogados nem expirados), do mais novo para o mais antigo. */
export async function listActiveShares(): Promise<ShareSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("third_party_shares")
    .select("id, person, from_month, to_month, expires_at, created_at")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    person: r.person,
    from: r.from_month,
    to: r.to_month,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

export interface SharedReportData {
  person: string;
  from: string;
  to: string;
  expiresAt: string;
  /** Só os gastos com parcela no período (o id é um índice, não o id real). */
  expenses: ThirdPartyExpense[];
  earlierPending: EarlierPending;
}

const sharedReportSchema = z.object({
  person: z.string(),
  fromMonth: z.string(),
  toMonth: z.string(),
  expiresAt: z.string(),
  expenses: z.array(
    z.object({
      id: z.string(),
      person: z.string(),
      description: z.string(),
      amountCents: z.number().int(),
      purchaseDate: z.string(),
      installments: z.number().int(),
      settlements: z.array(
        z.object({ installment: z.number().int(), amountCents: z.number().int(), settledAt: z.string() }),
      ),
    }),
  ),
  earlier: z.object({ cents: z.number().int(), count: z.number().int(), firstMonth: z.string().nullable() }),
});

/**
 * Leitura pública (sem sessão) de um link de compartilhamento. Usa só a chave
 * publicável: o papel anon não lê tabela nenhuma, apenas chama
 * get_shared_report(), que valida token, validade e revogação no banco.
 * Devolve null para qualquer link inválido, sem distinguir o motivo.
 */
export const getSharedReport = cache(async (token: string): Promise<SharedReportData | null> => {
  if (!shareTokenSchema.safeParse(token).success) return null;
  const supabase = createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("get_shared_report", { share_token: token });
  if (error) throw error;
  if (data === null) return null;
  const parsed = sharedReportSchema.parse(data);
  return {
    person: parsed.person,
    from: parsed.fromMonth,
    to: parsed.toMonth,
    expiresAt: parsed.expiresAt,
    expenses: parsed.expenses.map((e) => ({ ...e, notes: null })),
    earlierPending: parsed.earlier,
  };
});
