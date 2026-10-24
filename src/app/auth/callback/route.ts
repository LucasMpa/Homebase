import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/allowed-email";
import { createClient } from "@/lib/supabase/server";

/** Retorno do Google OAuth: troca o código pela sessão e valida o e-mail. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?erro=oauth", origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?erro=oauth", origin));

  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/access-denied", origin));
  }

  return NextResponse.redirect(new URL("/", origin));
}
