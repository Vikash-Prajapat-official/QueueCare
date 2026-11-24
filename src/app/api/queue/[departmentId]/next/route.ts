import { NextResponse } from "next/server";
import { requireRole, route } from "@/lib/api";
import { callNext } from "@/lib/queue-service";

// The doctor presses "Next": call the next waiting patient of this doctor's queue.
export const POST = route(async (req: Request, ctx: { params: Promise<{ departmentId: string }> }) => {
  const user = await requireRole(["DOCTOR"]);
  const { departmentId } = await ctx.params;
  return NextResponse.json({ token: await callNext(departmentId, user, req) });
});
