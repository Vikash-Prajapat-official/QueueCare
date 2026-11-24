import { NextResponse } from "next/server";
import { ApiError, requireRole, route } from "@/lib/api";
import { MAX_REPORT_DAYS, resolveRange } from "@/lib/reports";
import { getReport } from "@/lib/report-service";
import { hospitalToday } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

// GET /api/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD  (ADMIN)
// Tokens per department, average wait, average consult time and no-shows, for each day.
// Without dates it covers the last 7 days. At most 92 days at a time.
export const GET = route(async (req: Request) => {
  await requireRole(["ADMIN"]);
  const q = new URL(req.url).searchParams;
  const today = (await hospitalToday()).toISOString().slice(0, 10);
  const range = resolveRange(q.get("from"), q.get("to"), today, MAX_REPORT_DAYS);
  if (!range.ok) throw new ApiError(400, "VALIDATION", range.message);
  return NextResponse.json(await getReport(range.from, range.to), { headers: { "Cache-Control": "no-store" } });
});
