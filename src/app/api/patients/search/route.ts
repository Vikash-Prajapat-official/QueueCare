import { NextResponse } from "next/server";
import { ApiError, requireRole, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { searchPhoneSchema } from "@/lib/queue-schemas";
import { searchPatientsByPhone } from "@/lib/queue-service";

// Desk: find a returning patient by their full phone number (exact match only, so the patient
// list cannot be browsed). The phone number is not written to the audit log.
export const GET = route(async (req: Request) => {
  const user = await requireRole(["CLERK", "ADMIN"]);
  const raw = new URL(req.url).searchParams.get("phone") ?? "";
  const parsed = searchPhoneSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "VALIDATION", "Enter the full 10-digit phone number.");
  await audit(user.id, "patient.search", "Patient", null, req);
  return NextResponse.json({ items: await searchPatientsByPhone(parsed.data) });
});
