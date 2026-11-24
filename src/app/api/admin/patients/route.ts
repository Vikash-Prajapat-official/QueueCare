import { NextResponse } from "next/server";
import { ApiError, requireRole, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { findPatientsForAdmin } from "@/lib/patient-privacy";
import { phoneSchema } from "@/lib/validation";

// GET /api/admin/patients?phone=  (ADMIN): find a patient by full phone number, to export or erase their data.
export const GET = route(async (req: Request) => {
  const user = await requireRole(["ADMIN"]);
  const parsed = phoneSchema.safeParse(new URL(req.url).searchParams.get("phone") ?? "");
  if (!parsed.success) throw new ApiError(400, "VALIDATION", "Enter the full 10-digit phone number.");
  await audit(user.id, "patient.lookup", "Patient", null, req); // the number itself is not logged
  return NextResponse.json({ items: await findPatientsForAdmin(parsed.data) });
});
