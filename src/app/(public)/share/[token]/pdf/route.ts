import type { NextRequest } from "next/server";
import { reportPdfResponse } from "@/features/third-party/server/report-pdf";
import { todayInSaoPaulo } from "@/lib/dates";
import { monthOf } from "@/features/third-party/lib/expenses";
import { buildExportReport } from "@/features/third-party/lib/report";
import { getSharedReport } from "@/features/third-party/server/shares";
import { getToday } from "@/server/today";

/** PDF público de um link de compartilhamento. Link inválido, expirado ou revogado → 404. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/share/[token]/pdf">) {
  const { token } = await ctx.params;
  const [shared, today] = await Promise.all([getSharedReport(token), getToday()]);
  if (!shared) return new Response("Link não encontrado.", { status: 404, headers: { "X-Robots-Tag": "noindex" } });

  const report = buildExportReport(shared.expenses, {
    person: shared.person,
    from: shared.from,
    to: shared.to,
    currentMonth: monthOf(today),
    earlierPending: shared.earlierPending,
  });
  return reportPdfResponse(report, {
    generatedOn: today,
    validUntil: todayInSaoPaulo(new Date(shared.expiresAt)),
  });
}
