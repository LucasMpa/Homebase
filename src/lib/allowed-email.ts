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

/**
 * Rotas acessíveis sem sessão. Todo o resto exige login.
 * Ficam em src/app/(public)/; mantenha esta lista igual às pastas de lá.
 * /share: links públicos dos gastos de terceiros; a página valida o token no banco.
 * /api/cron: jobs agendados; cada rota exige o CRON_SECRET.
 */
export const PUBLIC_PATHS = ["/login", "/access-denied", "/auth/callback", "/share", "/api/cron"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
