// Pure role and route rules. Safe for the Edge runtime (used by middleware) and for unit tests.

export const ROLES = ["ADMIN", "CLERK", "DOCTOR"] as const;
export type Role = (typeof ROLES)[number];

export function hasRole(role: Role | null | undefined, allowed: readonly Role[]): boolean {
  return role != null && allowed.includes(role);
}

export function roleHome(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "CLERK":
      return "/desk";
    case "DOCTOR":
      return "/doctor";
  }
}

/** Page areas that need a login, and which roles may enter. */
export const PROTECTED_AREAS: readonly { prefix: string; roles: readonly Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/desk", roles: ["ADMIN", "CLERK"] },
  { prefix: "/doctor", roles: ["DOCTOR"] },
];

const CHANGE_PASSWORD = "/change-password";

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export type RouteDecision = { action: "allow" } | { action: "redirect"; to: string };

export interface RouteUser {
  role: Role;
  mustChangePassword: boolean;
}

/**
 * Coarse page-level routing from the session cookie. This only decides where to send the
 * browser. Real authorisation happens again on the server (requireRole / requirePageRole),
 * which re-reads the user from the database.
 */
export function decideRoute(pathname: string, user: RouteUser | null): RouteDecision {
  const area = PROTECTED_AREAS.find((a) => underPrefix(pathname, a.prefix));
  const isChangePassword = underPrefix(pathname, CHANGE_PASSWORD);
  const isLogin = underPrefix(pathname, "/login");

  if (!user) {
    if (area || isChangePassword) {
      return { action: "redirect", to: `/login?callbackUrl=${encodeURIComponent(pathname)}` };
    }
    return { action: "allow" };
  }

  if (user.mustChangePassword) {
    if (area || isLogin) return { action: "redirect", to: CHANGE_PASSWORD };
    return { action: "allow" };
  }

  if (isLogin) return { action: "redirect", to: roleHome(user.role) };
  if (area && !area.roles.includes(user.role)) return { action: "redirect", to: roleHome(user.role) };
  return { action: "allow" };
}
