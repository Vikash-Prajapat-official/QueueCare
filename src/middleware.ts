import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { decideRoute } from "@/lib/rbac";

// Edge-safe Auth.js instance: reads the session cookie only. API routes are NOT covered here;
// each one calls requireRole() itself (see src/lib/api.ts).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const u = req.auth?.user;
  const decision = decideRoute(
    req.nextUrl.pathname,
    u ? { role: u.role, mustChangePassword: u.mustChangePassword } : null,
  );
  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
