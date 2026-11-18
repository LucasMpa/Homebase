/**
 * Grava no banco (private.app_settings) o SHA-256 do CRON_SECRET. As funções do
 * job de avisos (get_reminder_data, record_bill_notifications) só respondem a
 * quem envia o segredo que bate com esse hash. Roda antes do `pnpm dev`.
 *
 * Produção: rode uma vez apontando para o projeto da nuvem, com o mesmo
 * CRON_SECRET cadastrado na Vercel (as variáveis da linha de comando têm
 * precedência sobre o .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<secret> \
 *   CRON_SECRET=<o da Vercel> pnpm sync:cron-secret
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const cronSecret = process.env.CRON_SECRET?.trim();

if (!cronSecret) {
  console.log("CRON_SECRET não definido: avisos por e-mail desligados neste ambiente (nada a sincronizar).");
  process.exit(0);
}
if (cronSecret.length < 32) {
  console.error("CRON_SECRET precisa ter pelo menos 32 caracteres. Gere um com: openssl rand -base64 32");
  process.exit(1);
}
if (!url || !secretKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.");
  process.exit(1);
}

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false } });
const hash = createHash("sha256").update(cronSecret).digest("hex");
const { error } = await supabase.rpc("set_cron_secret_hash", { secret_hash: hash });
if (error) {
  console.error(`Não foi possível sincronizar o CRON_SECRET (o Supabase está rodando?): ${error.message}`);
  process.exit(1);
}
console.log(`CRON_SECRET sincronizado com o banco (hash ${hash.slice(0, 8)}…).`);
