import type { NextRequest } from "next/server";
import { reportPdfResponse } from "@/features/third-party/server/report-pdf";
import { requireUser } from "@/server/auth";
import { monthOf } from "@/features/third-party/lib/expenses";
import { buildExportReport } from "@/features/third-party/lib/report";
import { exportParamsSchema } from "@/features/third-party/export-validation";
import { listExpenses } from "@/features/third-party/server/queries";
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
