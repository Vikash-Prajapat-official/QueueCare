import { describe, expect, it } from "vitest";
import { decideRoute, hasRole, roleHome, type Role } from "@/lib/rbac";

const user = (role: Role, mustChangePassword = false) => ({ role, mustChangePassword });
const allow = { action: "allow" } as const;
const to = (path: string) => ({ action: "redirect", to: path });

describe("hasRole", () => {
  it("allows listed roles only", () => {
    expect(hasRole("ADMIN", ["ADMIN"])).toBe(true);
    expect(hasRole("CLERK", ["ADMIN", "CLERK"])).toBe(true);
    expect(hasRole("DOCTOR", ["ADMIN", "CLERK"])).toBe(false);
  });

  it("refuses a missing role", () => {
    expect(hasRole(null, ["ADMIN"])).toBe(false);
    expect(hasRole(undefined, ["ADMIN", "CLERK", "DOCTOR"])).toBe(false);
  });
});

describe("roleHome", () => {
  it("sends each role to its own area", () => {
    expect(roleHome("ADMIN")).toBe("/admin");
    expect(roleHome("CLERK")).toBe("/desk");
    expect(roleHome("DOCTOR")).toBe("/doctor");
  });
});

describe("decideRoute: not logged in", () => {
  it.each(["/admin", "/admin/users", "/desk", "/desk/queues", "/doctor", "/change-password"])(
    "%s redirects to login and remembers the page",
    (path) => {
      expect(decideRoute(path, null)).toEqual(to(`/login?callbackUrl=${encodeURIComponent(path)}`));
    },
  );

  it.each(["/", "/login", "/health", "/checkin", "/t/ABCD2345", "/display/abc"])("%s is public", (path) => {
    expect(decideRoute(path, null)).toEqual(allow);
  });

  it("does not treat look-alike paths as protected", () => {
    expect(decideRoute("/administrator", null)).toEqual(allow);
    expect(decideRoute("/doctors-list", null)).toEqual(allow);
  });
});

describe("decideRoute: role areas", () => {
  const matrix: [Role, string, "allow" | "redirect"][] = [
    ["ADMIN", "/admin", "allow"],
    ["ADMIN", "/admin/departments", "allow"],
    ["ADMIN", "/desk", "allow"],
    ["ADMIN", "/doctor", "redirect"],
    ["CLERK", "/admin", "redirect"],
    ["CLERK", "/admin/users", "redirect"],
    ["CLERK", "/desk", "allow"],
    ["CLERK", "/doctor", "redirect"],
    ["DOCTOR", "/admin", "redirect"],
    ["DOCTOR", "/desk", "redirect"],
    ["DOCTOR", "/doctor", "allow"],
  ];

  it.each(matrix)("%s on %s -> %s", (role, path, expected) => {
    const d = decideRoute(path, user(role));
    expect(d.action).toBe(expected);
    if (d.action === "redirect") expect(d.to).toBe(roleHome(role));
  });

  it("sends a logged-in user away from the login page", () => {
    expect(decideRoute("/login", user("CLERK"))).toEqual(to("/desk"));
    expect(decideRoute("/login", user("DOCTOR"))).toEqual(to("/doctor"));
  });

  it("lets a logged-in user open the change-password page voluntarily", () => {
    expect(decideRoute("/change-password", user("DOCTOR"))).toEqual(allow);
  });
});

describe("decideRoute: forced password change", () => {
  it.each(["/admin", "/desk", "/doctor", "/login"])("%s redirects to change-password", (path) => {
    expect(decideRoute(path, user("ADMIN", true))).toEqual(to("/change-password"));
  });

  it("allows the change-password page itself and public pages", () => {
    expect(decideRoute("/change-password", user("ADMIN", true))).toEqual(allow);
    expect(decideRoute("/health", user("ADMIN", true))).toEqual(allow);
  });
});
