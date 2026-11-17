import type { NextRequest } from "next/server";
import { reportPdfResponse } from "@/components/third-party/report-pdf";
import { requireUser } from "@/lib/auth";
import { monthOf } from "@/lib/third-party";
import { buildExportReport } from "@/lib/third-party-report";
import { exportParamsSchema } from "@/lib/validation/third-party-export";
import { listExpenses } from "@/server/third-party";
import { getToday } from "@/server/today";

/** PDF dos gastos de terceiros: GET /third-party/export?person=Ana&from=2026-11&to=2027-04 (pessoa vazia = todas). */
export async function GET(request: NextRequest) {
  await requireUser();
  const params = request.nextUrl.searchParams;
  const parsed = exportParamsSchema.safeParse({
    person: params.get("person") ?? undefined,
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  });
  if (!parsed.success) return new Response("Parâmetros inválidos.", { status: 400 });

  const [expenses, today] = await Promise.all([listExpenses(), getToday()]);
  const report = buildExportReport(expenses, { ...parsed.data, currentMonth: monthOf(today) });
  return reportPdfResponse(report, { generatedOn: today });
}
