import { NextResponse } from "next/server";
import { ApiError, requireRole, route } from "@/lib/api";
import { db } from "@/lib/db";
import { getQueueSnapshot } from "@/lib/queue-service";

// Today's queue of a department. Desk staff see everything; a doctor sees only their own queue.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ departmentId: string }> }) => {
  const user = await requireRole(["CLERK", "ADMIN", "DOCTOR"]);
  const { departmentId } = await ctx.params;

  let scopeDoctorId: string | null = null;
  if (user.role === "DOCTOR") {
    const doctor = await db.doctor.findUnique({ where: { userId: user.id }, select: { id: true, departmentId: true } });
    if (!doctor || doctor.departmentId !== departmentId) {
      throw new ApiError(403, "FORBIDDEN", "This is not your department.");
    }
    scopeDoctorId = doctor.id;
  }
  return NextResponse.json(await getQueueSnapshot(departmentId, scopeDoctorId));
});
