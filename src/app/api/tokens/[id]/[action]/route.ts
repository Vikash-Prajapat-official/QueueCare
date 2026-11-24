import { NextResponse } from "next/server";
import { ApiError, readJson, requireRole, route } from "@/lib/api";
import { ACTION_ROLES, QUEUE_ACTIONS, type TokenAction } from "@/lib/queue";
import { applyTokenAction } from "@/lib/queue-service";

type Ctx = { params: Promise<{ id: string; action: string }> };

function tokenAction(value: string): TokenAction {
  // "next" is a department action (POST /api/queue/:departmentId/next), not a token action.
  if (value === "next" || !(QUEUE_ACTIONS as readonly string[]).includes(value)) {
    throw new ApiError(404, "NOT_FOUND", "Unknown action.");
  }
  return value as TokenAction;
}

// POST /api/tokens/:id/(skip | recall | no-show | start | complete | transfer | cancel)
export const POST = route(async (req: Request, ctx: Ctx) => {
  const { id, action: raw } = await ctx.params;
  const action = tokenAction(raw);
  const user = await requireRole(ACTION_ROLES[action]);
  const body = action === "transfer" ? await readJson(req) : undefined;
  return NextResponse.json({ token: await applyTokenAction(id, action, user, body, req) });
});
