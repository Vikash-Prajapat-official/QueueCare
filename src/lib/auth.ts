import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { ipFromHeaders } from "@/lib/audit";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { consume, resetLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

const LOGIN_WINDOW_MS = 15 * 60_000;

/** Thrown when too many logins were tried; the login page shows a clear message for it. */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// Compared against when the phone number is unknown, so a wrong phone and a wrong password
// take the same time and the response does not reveal which accounts exist.
const DUMMY_HASH = "$2b$12$YCCbI9/a7zsU3phtG2dZu.NQbIG/NlFxaQ9oI1F6ychKxtD44vwfu";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { phone: {}, password: {} },
      async authorize(raw, request) {
        // Guessing passwords: at most 10 tries per phone number and 30 per IP in 15 minutes.
        const ip = ipFromHeaders(request.headers);
        if (ip && !consume(`login-ip:${ip}`, 30, LOGIN_WINDOW_MS).ok) throw new RateLimitedSignin();

        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const phoneKey = `login:${parsed.data.phone}`;
        if (!consume(phoneKey, 10, LOGIN_WINDOW_MS).ok) throw new RateLimitedSignin();

        const user = await db.user.findUnique({ where: { phone: parsed.data.phone } });
        const passwordOk = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.active || !passwordOk) return null;
        resetLimit(phoneKey);

        await db.auditLog.create({
          data: { actorUserId: user.id, action: "login", entity: "User", entityId: user.id },
        });
        return {
          id: user.id,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
});
