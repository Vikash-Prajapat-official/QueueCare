import { ApiError, requireRole, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { hospitalToday } from "@/lib/queue-service";
import { MAX_EXPORT_DAYS, resolveRange } from "@/lib/reports";
import { hospitalTimezone, tokensCsvStream } from "@/lib/report-service";

export const dynamic = "force-dynamic";

// GET /api/export/tokens.csv?from=&to=  (ADMIN). One row per token, no patient names or phone numbers.
export const GET = route(async (req: Request) => {
  const user = await requireRole(["ADMIN"]);
  const q = new URL(req.url).searchParams;
  const today = (await hospitalToday()).toISOString().slice(0, 10);
  const range = resolveRange(q.get("from"), q.get("to"), today, MAX_EXPORT_DAYS);
  if (!range.ok) throw new ApiError(400, "VALIDATION", range.message);

  await audit(user.id, "export.tokens", "Token", `${range.from}..${range.to}`, req);
  const stream = tokensCsvStream(range.from, range.to, await hospitalTimezone());
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="queuecare-tokens-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
