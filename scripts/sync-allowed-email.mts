/**
 * Copia ALLOWED_EMAIL do .env.local para o banco (private.app_settings), onde o
 * Auth hook e as políticas de RLS o usam. Roda automaticamente antes do `pnpm dev`.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

if (!url || !secretKey || !email) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e ALLOWED_EMAIL no .env.local.");
  process.exit(1);
}

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false } });
const { error } = await supabase.rpc("set_allowed_email", { email });
if (error) {
  console.error(`Não foi possível sincronizar ALLOWED_EMAIL (o Supabase local está rodando?): ${error.message}`);
  process.exit(1);
}
console.log(`ALLOWED_EMAIL sincronizado com o banco: ${email}`);
