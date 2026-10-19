/**
 * Regra de acesso: somente o e-mail em ALLOWED_EMAIL entra no app.
 * Sem import de "server-only" porque também roda no proxy; ALLOWED_EMAIL não
 * tem prefixo NEXT_PUBLIC_, então nunca é embutido no bundle do cliente.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  // Sem ALLOWED_EMAIL configurado ninguém entra (falha fechada).
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed;
}

/** Rotas acessíveis sem sessão. Todo o resto exige login. */
export const PUBLIC_PATHS = ["/login", "/acesso-negado", "/auth/callback"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
