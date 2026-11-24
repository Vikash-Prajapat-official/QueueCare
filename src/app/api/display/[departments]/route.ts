import { NextResponse } from "next/server";
import { ApiError, requireRole, route } from "@/lib/api";
import { db } from "@/lib/db";
import { isValidDisplayKey, parseDepartmentIds } from "@/lib/display";
import { getDisplayState } from "@/lib/display-service";
import { enforceIp } from "@/lib/public-limits";
import { ROLES } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// State of the TV board. Open to a valid display key (the TV has no login) or to any logged-in
// user (to preview a board). It never contains patient names or phone numbers.
export const GET = route(async (req: Request, ctx: { params: Promise<{ departments: string }> }) => {
  const { departments } = await ctx.params;
  const ids = parseDepartmentIds(departments);
  if (!ids) throw new ApiError(400, "VALIDATION", "Invalid department list.");

  const key = new URL(req.url).searchParams.get("key");
  if (!isValidDisplayKey(key)) {
    if (key) enforceIp(req.headers, "display-key", 20, 60_000, "wrong display keys"); // stops key guessing
    await requireRole(ROLES);
  }

  const found = await db.department.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ApiError(404, "NOT_FOUND", "Department not found.");

  return NextResponse.json(await getDisplayState(ids), { headers: { "Cache-Control": "no-store" } });
});
