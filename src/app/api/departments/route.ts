import { NextResponse } from "next/server";
import { requireRole, route } from "@/lib/api";
import { listDepartments } from "@/lib/queue-service";
import { ROLES } from "@/lib/rbac";

// Any logged-in role: departments with today's counts and their doctors.
export const GET = route(async () => {
  await requireRole(ROLES);
  return NextResponse.json({ items: await listDepartments() });
});
