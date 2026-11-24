import { NextResponse } from "next/server";
import { ApiError, requireRole, route } from "@/lib/api";
import { db } from "@/lib/db";
import { isValidDisplayKey, parseDepartmentIds } from "@/lib/display";
import { getDisplayState } from "@/lib/display-service";
import { ROLES } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// State of the TV board. Open to a valid display key (the TV has no login) or to any logged-in
// user (to preview a board). It never contains patient names or phone numbers.
export const GET = route(async (req: Request, ctx: { params: Promise<{ departments: string }> }) => {
  const { departments } = await ctx.params;
  const ids = parseDepartmentIds(departments);
  if (!ids) throw new ApiError(400, "VALIDATION", "Invalid department list.");

  if (!isValidDisplayKey(new URL(req.url).searchParams.get("key"))) await requireRole(ROLES);

  const found = await db.department.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ApiError(404, "NOT_FOUND", "Department not found.");

  return NextResponse.json(await getDisplayState(ids), { headers: { "Cache-Control": "no-store" } });
});
