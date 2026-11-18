import type { NextRequest } from "next/server";
import {
  createReminderJobDeps,
  ReminderJobUnauthorizedError,
  runReminderJob,
} from "@/features/bills/server/reminder-job";
import { isPlainDate } from "@/lib/dates";
import { appBaseUrl, isAuthorizedCron } from "@/server/cron";
import { getToday } from "@/server/today";

/**
 * Resumo diário dos avisos de vencimento, chamado pelo Vercel Cron (vercel.json).
 * Exige `Authorization: Bearer <CRON_SECRET>`.
 *
 *   GET /api/cron/bill-reminders                 envia o resumo de hoje (se houver aviso)
 *   GET /api/cron/bill-reminders?dry-run=1       só mostra o que seria enviado, em JSON
 *   GET ...?dry-run=1&format=html                o e-mail em HTML, para conferir o visual
 *   GET ...?dry-run=1&date=2026-11-20            simula outro dia (só no dry-run)
 */

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET não configurado." }, 500);
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) {
    return json({ error: "Não autorizado." }, 401);
  }

  const params = request.nextUrl.searchParams;
  const dryRun = params.get("dry-run") === "1";
  const date = params.get("date");
  if (date !== null && (!dryRun || !isPlainDate(date))) {
    return json({ error: "date só é aceito com dry-run=1, no formato AAAA-MM-DD." }, 400);
  }

  const today = date ?? (await getToday());
  const appUrl = appBaseUrl(process.env, request.nextUrl.origin);

  try {
    const result = await runReminderJob(createReminderJobDeps(secret), { today, appUrl, dryRun });
    if (dryRun && params.get("format") === "html") {
      const html = result.status === "dry-run" ? result.html! : "<p>Nenhum aviso para este dia.</p>";
      return new Response(html, { headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" } });
    }
    // Resposta (e log) sem o HTML do e-mail.
    const summary = result.status === "nothing" ? result : { ...result, html: undefined };
    console.info(`[bill-reminders] ${summary.status} em ${today}`, "reminders" in summary ? summary.reminders.length : 0);
    return json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bill-reminders] falhou:", message);
    const status = error instanceof ReminderJobUnauthorizedError ? 503 : 500;
    return json({ error: message }, status);
  }
}
