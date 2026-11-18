import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Rotas de cron (/api/cron/*). A Vercel chama com `Authorization: Bearer <CRON_SECRET>`
 * quando a variável CRON_SECRET existe no projeto; qualquer outra chamada é recusada.
 */

/** Tamanho mínimo do segredo (o banco também exige ≥ 32). */
export const MIN_CRON_SECRET_LENGTH = 32;

/** Compara o cabeçalho Authorization com o segredo em tempo constante. */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Base dos links do e-mail: APP_URL, senão o domínio de produção da Vercel,
 * senão a origem da própria requisição (ambiente local).
 */
export function appBaseUrl(
  env: { APP_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string; [key: string]: string | undefined },
  requestOrigin: string,
): string {
  if (env.APP_URL?.trim()) return env.APP_URL.trim().replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`;
  return requestOrigin.replace(/\/+$/, "");
}
