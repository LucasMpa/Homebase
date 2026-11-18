/**
 * E-mail do resumo diário de vencimentos: assunto, HTML e texto puro.
 * Função pura (sem envio). O HTML segue o layout aprovado (contêiner de 600px,
 * card de total, uma seção por urgência, cada conta em um card) com tabelas e
 * estilos inline, que é o que os clientes de e-mail suportam. As cores são as
 * do app (src/app/globals.css), todas no objeto C abaixo.
 */

import type { PlainDate } from "@/lib/dates";
import { formatDate, weekdayName } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import type { Reminder, ReminderKind } from "./reminders";

const C = {
  /** Fundo fora do contêiner (--background). */
  page: "#161e2f",
  /** Contêiner do e-mail (--sidebar). */
  container: "#1b2438",
  /** Cards (--card) e bordas (--border). */
  card: "#242f49",
  border: "#384358",
  /** Rodapé, um tom abaixo do contêiner (--muted). */
  footer: "#1d2639",
  foreground: "#e8ecf4",
  muted: "#9aa4b8",
  primary: "#5fd38d",
  primaryForeground: "#161e2f",
  /** Pílula "N contas no resumo": verde translúcido. */
  primarySoft: "rgba(95, 211, 141, 0.12)",
  primarySoftBorder: "rgba(95, 211, 141, 0.4)",
  /** Atraso: texto (--overdue-foreground) e filete do card (--overdue). */
  overdue: "#ff8e98",
  overdueStrong: "#b51a2b",
  /** Marca: mesmas cores do ícone do app (src/app/icon.svg). */
  logoBackground: "#1b2333",
  logoBorder: "#2a344b",
  logoMark: "#7ed497",
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Espaços invisíveis depois da prévia: impedem o cliente de completá-la com o começo do corpo. */
const PREVIEW_PADDING = "&#847;&zwnj;&nbsp;".repeat(60);

export interface ReminderEmail {
  subject: string;
  html: string;
  text: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Assunto fixo, só com a data: "Resumo das contas no Homebase - 17/11". O conteúdo fica no corpo. */
export function reminderSubject(today: PlainDate): string {
  return `Resumo das contas no Homebase - ${formatDate(today).slice(0, 5)}`;
}

/** Soma dos valores estimados das contas do resumo (as sem valor não entram). */
export function reminderTotals(reminders: readonly Reminder[]): { totalCents: number; count: number; withAmount: number } {
  const withAmount = reminders.filter((r) => r.bill.estimatedAmountCents !== null);
  return {
    totalCents: withAmount.reduce((sum, r) => sum + (r.bill.estimatedAmountCents ?? 0), 0),
    count: reminders.length,
    withAmount: withAmount.length,
  };
}

/** "1 conta atrasada · 1 vence hoje · 2 vencem nos próximos dias" */
function countsSummary(reminders: readonly Reminder[]): string {
  const count = (kinds: ReminderKind[]) => reminders.filter((r) => kinds.includes(r.kind)).length;
  const overdue = count(["overdue"]);
  const today = count(["due_today"]);
  const soon = count(["due_in_1", "due_in_3", "due_in_7"]);
  return [
    overdue > 0 && `${overdue} ${plural(overdue, "conta atrasada", "contas atrasadas")}`,
    today > 0 && `${today} ${plural(today, "vence hoje", "vencem hoje")}`,
    soon > 0 && `${soon} ${plural(soon, "vence nos próximos dias", "vencem nos próximos dias")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Prévia que os clientes de e-mail mostram ao lado do assunto:
 * "Total a pagar informado: R$ 2.659,89 · 1 conta atrasada · 1 vence hoje · 3 vencem nos próximos dias".
 */
export function reminderPreview(reminders: readonly Reminder[]): string {
  const { totalCents, withAmount } = reminderTotals(reminders);
  const counts = countsSummary(reminders);
  return withAmount > 0 ? `Total a pagar informado: ${formatBRL(totalCents)} · ${counts}` : counts;
}

/**
 * Seções do e-mail, em ordem de urgência. "Vence em breve" junta os avisos de
 * 3 e 7 dias (cada linha já mostra a data).
 */
export const REMINDER_SECTIONS: readonly { title: string; kinds: readonly ReminderKind[] }[] = [
  { title: "Atrasadas", kinds: ["overdue"] },
  { title: "Vence hoje", kinds: ["due_today"] },
  { title: "Vence amanhã", kinds: ["due_in_1"] },
  { title: "Vence em breve", kinds: ["due_in_3", "due_in_7"] },
];

/** "Vence em breve – 3 contas" */
export function sectionHeading(title: string, count: number): string {
  return `${title} – ${count} ${plural(count, "conta", "contas")}`;
}

/** "Venceu em 10/11/2026 • 8 dias de atraso", "Vence em 20/11/2026 (sexta)"… */
export function reminderDetail(r: Reminder): string {
  const date = formatDate(r.dueDate);
  if (r.kind === "overdue") return `Venceu em ${date} • ${r.days} ${plural(r.days, "dia", "dias")} de atraso`;
  if (r.kind === "due_today") return `Vence hoje, ${date}`;
  return `Vence em ${date} (${weekdayName(r.dueDate)})`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function billUrl(appUrl: string, billId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/bills/${encodeURIComponent(billId)}`;
}

function sections(reminders: readonly Reminder[]): { title: string; overdue: boolean; items: Reminder[] }[] {
  return REMINDER_SECTIONS.map(({ title, kinds }) => ({
    title,
    overdue: kinds.includes("overdue"),
    items: reminders
      .filter((r) => kinds.includes(r.kind))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name, "pt-BR")),
  })).filter((g) => g.items.length > 0);
}

/** Um card de conta: nome e detalhe à esquerda; valor e "Ver conta" à direita. */
function billCard(r: Reminder, base: string, overdue: boolean, last: boolean): string {
  const cents = r.bill.estimatedAmountCents;
  const amount =
    cents === null
      ? `<span class="bill-amount" style="font-size:14px;font-style:italic;color:${C.muted};white-space:nowrap;">valor não informado</span>`
      : `<span class="bill-amount" style="font-size:16px;font-weight:700;color:${C.foreground};white-space:nowrap;">${formatBRL(cents)}</span>`;
  const accent = overdue ? `border-left:3px solid ${C.overdueStrong};` : `border:1px solid ${C.border};`;
  // Valor e botão numa tabela de duas células. No desktop a coluna tem a largura
  // mínima (width 1%), então os dois ficam juntos à direita; no celular ela
  // ocupa a linha toda (.stack-column-right) e vira space-between: valor à
  // esquerda, botão à direita.
  return `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.card};${accent}border-radius:12px;${last ? "" : "margin-bottom:10px;"}">
                <tr>
                  <td style="padding:16px 20px;font-family:${FONT};" valign="middle" class="stack-column">
                    <div style="font-size:15px;font-weight:600;color:${C.foreground};margin-bottom:4px;">${escapeHtml(r.bill.name)}</div>
                    <div style="font-size:12px;color:${overdue ? C.overdue : C.muted};">${escapeHtml(reminderDetail(r))}</div>
                  </td>
                  <td width="1%" style="width:1%;padding:16px 20px;font-family:${FONT};" valign="middle" class="stack-column-right">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                      <tr>
                        <td align="left" valign="middle" style="text-align:left;font-family:${FONT};">${amount}</td>
                        <td align="right" valign="middle" style="text-align:right;padding-left:14px;white-space:nowrap;font-family:${FONT};">
                          <a href="${escapeHtml(billUrl(base, r.bill.id))}" target="_blank" style="display:inline-block;background-color:${C.primary};color:${C.primaryForeground};font-size:13px;font-weight:700;text-decoration:none;padding:7px 14px;border-radius:8px;">Ver conta</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

/** Monta o resumo. `today` é a data do envio (São Paulo); `appUrl` é a base dos links. */
export function buildReminderEmail(
  reminders: readonly Reminder[],
  { today, appUrl }: { today: PlainDate; appUrl: string },
): ReminderEmail {
  const subject = reminderSubject(today);
  const dateLine = `${weekdayName(today)}, ${formatDate(today)}`;
  const base = appUrl.replace(/\/+$/, "");
  const billsUrl = escapeHtml(`${base}/bills`);
  const { totalCents, count } = reminderTotals(reminders);
  const groups = sections(reminders);

  const sectionsHtml = groups
    .map(({ title, overdue, items }, i) => {
      const top = i === 0 ? 0 : 10;
      const bottom = i === groups.length - 1 ? 24 : 14;
      const heading = overdue
        ? `<span style="display:inline-block;width:6px;height:6px;background-color:${C.overdue};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>${escapeHtml(sectionHeading(title, items.length))}`
        : escapeHtml(sectionHeading(title, items.length));
      return `
          <tr>
            <td style="padding:${top}px 36px ${bottom}px 36px;font-family:${FONT};" class="mobile-padding">
              <div style="font-size:13px;font-weight:600;color:${overdue ? C.overdue : C.muted};margin-bottom:10px;">${heading}</div>${items
                .map((r, j) => billCard(r, base, overdue, j === items.length - 1))
                .join("")}
            </td>
          </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    /* separate (e não collapse): com collapse os clientes ignoram o border-radius das tabelas. */
    table { border-collapse: separate !important; border-spacing: 0; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${C.page}; font-family: ${FONT}; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 16px !important; }
      .email-footer { border-radius: 0 0 16px 16px !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      /* border-box: sem isso, width 100% + padding da célula passa da largura do card e empurra o e-mail para fora da tela. */
      .stack-column { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: left !important; }
      .stack-column-right { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: left !important; padding-top: 0 !important; }
      /* No celular o valor pode quebrar linha; no desktop fica numa linha só. */
      .bill-amount { white-space: normal !important; }
      /* Card do total centralizado: rótulo, valor e a pílula "N contas no resumo", com um respiro
         entre o valor e a pílula. Vem depois de .stack-column(-right) para prevalecer. */
      .total-amount { text-align: center !important; }
      .total-badge { text-align: center !important; padding-top: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
  <div style="display:none;font-size:1px;color:${C.page};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(reminderPreview(reminders))}${PREVIEW_PADDING}</div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.page};">
    <tr>
      <td align="center" style="padding:32px 12px 48px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="max-width:600px;background-color:${C.container};border-radius:20px;overflow:hidden;border:1px solid ${C.border};" class="email-container">

          <tr>
            <td align="left" style="padding:36px 36px 20px 36px;font-family:${FONT};" class="mobile-padding">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="width:28px;height:28px;background-color:${C.logoBackground};border:1px solid ${C.logoBorder};border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:${C.logoMark};font-size:15px;font-weight:bold;line-height:28px;">&#8962;</span>
                  </td>
                  <td style="padding-left:10px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.foreground};letter-spacing:-0.3px;">Homebase</td>
                </tr>
              </table>
              <h1 style="margin:24px 0 6px 0;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:700;color:${C.foreground};letter-spacing:-0.5px;">Resumo das contas</h1>
              <p style="margin:0;font-family:${FONT};font-size:14px;color:${C.muted};">${escapeHtml(dateLine)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 28px 36px;font-family:${FONT};" class="mobile-padding">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.card};border-radius:14px;border:1px solid ${C.border};">
                <tr>
                  <td style="padding:20px 24px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                      <tr>
                        <td valign="middle" class="stack-column total-amount" style="font-family:${FONT};">
                          <div style="font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Total a pagar informado</div>
                          <div style="font-size:28px;font-weight:800;color:${C.foreground};letter-spacing:-0.5px;">${formatBRL(totalCents)}</div>
                        </td>
                        <td align="right" valign="middle" class="stack-column-right total-badge" style="font-family:${FONT};">
                          <div style="display:inline-block;background-color:${C.primarySoft};border:1px solid ${C.primarySoftBorder};border-radius:20px;padding:5px 12px;color:${C.primary};font-size:12px;font-weight:600;">${count} ${plural(count, "conta no resumo", "contas no resumo")}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 24px 36px;" class="mobile-padding">
              <div style="height:1px;width:100%;background-color:${C.border};line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>
${sectionsHtml}

          <tr>
            <td style="padding:0 36px 32px 36px;" class="mobile-padding">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                <tr>
                  <td align="center" style="background-color:${C.primary};border-radius:10px;">
                    <a href="${billsUrl}" target="_blank" style="display:block;width:100%;padding:16px 24px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.primaryForeground};text-decoration:none;text-align:center;box-sizing:border-box;">Gerenciar todas as contas no painel &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:${C.footer};border-top:1px solid ${C.border};border-radius:0 0 20px 20px;padding:28px 36px 32px 36px;text-align:center;font-family:${FONT};" class="mobile-padding email-footer">
              <p style="margin:0 0 16px 0;font-size:12px;line-height:1.6;color:${C.muted};">Avisos de 7, 3 e 1 dia antes, no dia do vencimento e, para contas atrasadas, no 1º dia e depois a cada 7 dias até o pagamento.</p>
              <p style="margin:0;"><a href="${billsUrl}" target="_blank" style="font-size:13px;font-weight:600;color:${C.primary};text-decoration:none;">Abrir contas no Homebase</a></p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "Resumo das contas",
    dateLine,
    "",
    `Total a pagar informado: ${formatBRL(totalCents)} (${count} ${plural(count, "conta", "contas")} no resumo)`,
    ...groups.flatMap(({ title, items }) => [
      "",
      sectionHeading(title, items.length),
      ...items.map((r) => {
        const value = r.bill.estimatedAmountCents === null ? "valor não informado" : formatBRL(r.bill.estimatedAmountCents);
        return `- ${r.bill.name}: ${value}. ${reminderDetail(r)}.\n  ${billUrl(base, r.bill.id)}`;
      }),
    ]),
    "",
    `Gerenciar todas as contas: ${base}/bills`,
  ].join("\n");

  return { subject, html, text };
}
