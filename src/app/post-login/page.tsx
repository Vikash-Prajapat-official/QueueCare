import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/page-auth";
import { roleHome } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Where a login lands when no other page was asked for: sends each person to their own home page,
// so the address bar always shows the real page (never "/login" with a desk inside).
export default async function PostLoginPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.mustChangePassword ? "/change-password" : roleHome(user.role));
}
