import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, isPublicPath } from "@/lib/allowed-email";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Renova a sessão a cada requisição e aplica as regras de acesso:
 * sem sessão → /login; e-mail não permitido → signOut + /acesso-negado.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const extraHeaders: Record<string, string> = {};

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        Object.assign(extraHeaders, headers);
      },
    },
  });

  // getUser() valida o token no servidor de Auth (inclui o limite de 30 dias da sessão).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Preserva cookies de sessão atualizados (ou removidos pelo signOut).
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [key, value] of Object.entries(extraHeaders)) redirect.headers.set(key, value);
    return redirect;
  };

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return pathname === "/acesso-negado" ? withHeaders(response, extraHeaders) : redirectTo("/acesso-negado");
  }

  if (!user && !isPublicPath(pathname)) return redirectTo("/login");
  if (user && pathname === "/login") return redirectTo("/");

  return withHeaders(response, extraHeaders);
}

function withHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
