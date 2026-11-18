import "server-only";

/**
 * Envio de e-mail, sem SDK (só fetch):
 * - RESEND_API_KEY definida → Resend (produção).
 * - senão, MAILPIT_URL definida → Mailpit (desenvolvimento; nada sai da máquina).
 * - nenhuma das duas → erro: melhor falhar alto do que "enviar" para lugar nenhum.
 *
 * EMAIL_FROM define o remetente. Sem domínio verificado no Resend, use o padrão
 * dele (onboarding@resend.dev), que só entrega para o e-mail da própria conta.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SentEmail {
  provider: "resend" | "mailpit";
  id: string;
}

const DEFAULT_FROM = "Homebase <onboarding@resend.dev>";

/** "Nome <email@x>" → { name, email }; só "email@x" → { email }. */
export function parseAddress(address: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(address);
  return match ? { name: match[1] || undefined, email: match[2] } : { email: address.trim() };
}

/** Variáveis que definem o envio (por padrão, as do processo). */
export interface EmailEnv {
  RESEND_API_KEY?: string;
  MAILPIT_URL?: string;
  EMAIL_FROM?: string;
  [key: string]: string | undefined;
}

export async function sendEmail(message: EmailMessage, env: EmailEnv = process.env): Promise<SentEmail> {
  const from = env.EMAIL_FROM?.trim() || DEFAULT_FROM;

  if (env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !body.id) {
      throw new Error(`Resend recusou o e-mail (${response.status}): ${body.message ?? "sem detalhes"}`);
    }
    return { provider: "resend", id: body.id };
  }

  if (env.MAILPIT_URL) {
    const sender = parseAddress(from);
    const response = await fetch(`${env.MAILPIT_URL.replace(/\/+$/, "")}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: sender.email, Name: sender.name ?? "" },
        To: [{ Email: message.to }],
        Subject: message.subject,
        HTML: message.html,
        Text: message.text,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { ID?: string };
    if (!response.ok || !body.ID) throw new Error(`Mailpit recusou o e-mail (${response.status}).`);
    return { provider: "mailpit", id: body.ID };
  }

  throw new Error("Nenhum envio de e-mail configurado: defina RESEND_API_KEY (produção) ou MAILPIT_URL (local).");
}
