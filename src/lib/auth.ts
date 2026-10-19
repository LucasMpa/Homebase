import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isAllowedEmail } from "@/lib/allowed-email";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante sessão válida E e-mail permitido, no servidor. Deve ser chamado em
 * todo layout/página protegida e em toda Server Action — não confiamos só no proxy.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    redirect("/acesso-negado");
  }
  return { user, supabase };
});
