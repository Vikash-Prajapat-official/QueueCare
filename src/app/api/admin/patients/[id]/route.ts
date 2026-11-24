import { NextResponse } from "next/server";
import { requireRole, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { erasePatient } from "@/lib/patient-privacy";

// DELETE /api/admin/patients/:id  (ADMIN): erase one patient's name, phone and ABHA number on request.
export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(["ADMIN"]);
  const { id } = await ctx.params;
  await erasePatient(id);
  await audit(user.id, "patient.erase", "Patient", id, req);
  return NextResponse.json({ ok: true });
});
