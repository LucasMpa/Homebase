/**
 * E-mail do resumo diário de vencimentos: assunto, HTML e texto puro.
 * Função pura (sem envio). O HTML usa tabelas e estilos inline, que é o que os
 * clientes de e-mail suportam, com a paleta do app (src/app/globals.css).
 */

import type { PlainDate } from "@/lib/dates";
import { formatDate, weekdayName } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import type { Reminder, ReminderKind } from "./reminders";

const C = {
  background: "#161e2f",
  card: "#242f49",
  border: "#384358",
  foreground: "#e8ecf4",
  muted: "#9aa4b8",
  primary: "#5fd38d",
  primaryForeground: "#161e2f",
  overdue: "#ff8e98",
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface ReminderEmail {
  subject: string;
  html: string;
  text: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Homebase: 1 conta atrasada · 1 vence hoje · 2 vencem nos próximos dias" */
export function reminderSubject(reminders: readonly Reminder[]): string {
  const count = (kinds: ReminderKind[]) => reminders.filter((r) => kinds.includes(r.kind)).length;
  const overdue = count(["overdue"]);
  const today = count(["due_today"]);
  const soon = count(["due_in_1", "due_in_3", "due_in_7"]);
  const parts = [
    overdue > 0 && `${overdue} ${plural(overdue, "conta atrasada", "contas atrasadas")}`,
    today > 0 && `${today} ${plural(today, "vence hoje", "vencem hoje")}`,
    soon > 0 && `${soon} ${plural(soon, "vence nos próximos dias", "vencem nos próximos dias")}`,
  ].filter(Boolean);
  return `Homebase: ${parts.join(" · ")}`;
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

/** "Vence em breve - 3 contas" */
export function sectionHeading(title: string, count: number): string {
  return `${title} - ${count} ${plural(count, "conta", "contas")}`;
}

/** "Venceu em 10/11/2026 · 8 dias de atraso", "Vence em 20/11/2026 (sexta)"… */
export function reminderDetail(r: Reminder): string {
  const date = formatDate(r.dueDate);
  if (r.kind === "overdue") return `Venceu em ${date} · ${r.days} ${plural(r.days, "dia", "dias")} de atraso`;
  if (r.kind === "due_today") return `Vence hoje, ${date}`;
  return `Vence em ${date} (${weekdayName(r.dueDate)})`;
}

function amount(r: Reminder): string {
  return r.bill.estimatedAmountCents === null ? "valor não informado" : formatBRL(r.bill.estimatedAmountCents);
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

/** Monta o resumo. `today` é a data do envio (São Paulo); `appUrl` é a base dos links. */
export function buildReminderEmail(
  reminders: readonly Reminder[],
  { today, appUrl }: { today: PlainDate; appUrl: string },
): ReminderEmail {
  const subject = reminderSubject(reminders);
  const dateLine = `${weekdayName(today)}, ${formatDate(today)}`;
  const base = appUrl.replace(/\/+$/, "");

  const sectionsHtml = sections(reminders)
    .map(({ title, overdue, items }) => {
      const color = overdue ? C.overdue : C.foreground;
      const rows = items
        .map((r, i) => {
          const divider = i > 0 ? `border-top:1px solid ${C.border};` : "";
          return `
          <tr>
            <td style="${divider}padding:14px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${FONT};vertical-align:top;">
                    <div style="font-size:15px;font-weight:600;color:${C.foreground};">${escapeHtml(r.bill.name)}</div>
                    <div style="font-size:13px;color:${overdue ? C.overdue : C.muted};padding-top:2px;">${escapeHtml(reminderDetail(r))}</div>
                  </td>
                  <td align="right" style="font-family:${FONT};vertical-align:top;white-space:nowrap;padding-left:12px;">
                    <div style="font-size:15px;font-weight:600;color:${C.foreground};">${escapeHtml(amount(r))}</div>
                    <a href="${escapeHtml(billUrl(base, r.bill.id))}" style="display:inline-block;margin-top:8px;padding:6px 12px;border-radius:8px;background:${C.primary};color:${C.primaryForeground};font-size:13px;font-weight:600;text-decoration:none;">Ver conta</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
        })
        .join("");
      return `
      <tr>
        <td style="padding:24px 0 8px;font-family:${FONT};font-size:16px;font-weight:600;color:${color};">${escapeHtml(sectionHeading(title, items.length))}</td>
      </tr>
      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;">
            ${rows}
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.background};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(subject.replace(/^Homebase: /, ""))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.background};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="font-family:${FONT};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;"><img src="${escapeHtml(base)}/apple-icon.png" width="28" height="28" alt="" style="display:block;border-radius:6px;"></td>
                <td style="vertical-align:middle;padding-left:8px;font-size:17px;font-weight:600;color:${C.foreground};">Homebase</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;font-family:${FONT};">
            <div style="font-size:22px;font-weight:600;color:${C.foreground};">Resumo das contas</div>
            <div style="font-size:14px;color:${C.muted};padding-top:4px;">${escapeHtml(dateLine)}</div>
          </td>
        </tr>
        ${sectionsHtml}
        <tr>
          <td style="padding-top:28px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">
            Avisos de 7, 3 e 1 dia antes, no dia do vencimento e, para contas atrasadas, no 1º dia e depois a cada 7 dias até o pagamento.
            <br><a href="${escapeHtml(base)}/bills" style="color:${C.primary};text-decoration:none;">Abrir contas no Homebase</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    "Resumo das contas",
    dateLine,
    ...sections(reminders).flatMap(({ title, items }) => [
      "",
      sectionHeading(title, items.length),
      ...items.map((r) => `- ${r.bill.name}: ${amount(r)}. ${reminderDetail(r)}.\n  ${billUrl(base, r.bill.id)}`),
    ]),
    "",
    `Abrir contas: ${base}/bills`,
  ].join("\n");

  return { subject, html, text };
}
