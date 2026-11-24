import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, readJson, requireRole, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";
import { enforce } from "@/lib/public-limits";
import { ROLES } from "@/lib/rbac";
import { changePasswordSchema } from "@/lib/validation";

// Any logged-in role may change its own password, including users who are forced to.
export const POST = route(async (req: Request) => {
  const actor = await requireRole(ROLES, { allowPasswordChangePending: true });
  if (isDemoMode()) throw new ApiError(403, "DEMO_MODE", "This is a public demo: passwords and user accounts cannot be changed.");
  // Someone with a stolen session could guess the current password, so tries are limited per user.
  enforce(`password:${actor.id}`, 10, 15 * 60_000, "password attempts");
  const { currentPassword, newPassword } = changePasswordSchema.parse(await readJson(req));

  const user = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "WRONG_PASSWORD", "Current password is incorrect.");
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, "SAME_PASSWORD", "Choose a password different from the current one.");
  }

  await db.user.update({
    where: { id: actor.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false },
  });
  await audit(actor.id, "change-password", "User", actor.id, req);
  return NextResponse.json({ ok: true });
});
