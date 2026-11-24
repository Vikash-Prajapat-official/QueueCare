import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Edge-safe part of the Auth.js config (no database, no bcrypt). Shared with middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  // Self-hosted on a LAN or behind Caddy, so the host cannot be fixed in advance.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // one clinic shift
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.departmentId = user.departmentId;
      }
      return token;
    },
    session({ session, token }) {
      // With the JWT strategy `token` is always the JWT, but Auth.js types it as a union.
      const t = token as JWT;
      session.user.id = t.uid;
      session.user.role = t.role;
      session.user.mustChangePassword = t.mustChangePassword;
      session.user.departmentId = t.departmentId;
      return session;
    },
  },
} satisfies NextAuthConfig;
