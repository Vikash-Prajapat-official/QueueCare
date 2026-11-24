import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleHome, type Role } from "@/lib/rbac";

/** Current user from the database (not just the cookie). Cached per request. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, active: true, departmentId: true, mustChangePassword: true },
  });
  return user && user.active ? user : null;
});

/** Server-side role check for pages. Redirects instead of rendering for the wrong user. */
export async function requirePageRole(allowed: readonly Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!allowed.includes(user.role)) redirect(roleHome(user.role));
  return user;
}
