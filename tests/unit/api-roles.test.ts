import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/rbac";

// The session and the database are faked so these tests check only the role rules of each route.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(async () => [] as unknown[]),
  writes: [] as string[],
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/db", () => {
  const WRITES = new Set(["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany"]);
  const model = (modelName: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string): unknown => {
          if (modelName === "user" && method === "findUnique") return mocks.userFindUnique;
          if (modelName === "user" && method === "findMany") return mocks.userFindMany;
          return async () => {
            if (WRITES.has(method)) mocks.writes.push(`${modelName}.${method}`);
            return method === "findMany" ? [] : null;
          };
        },
      },
    );
  const fake: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string): unknown =>
      prop === "$transaction" ? async (fn: (tx: unknown) => unknown) => fn(fake) : model(prop),
  });
  return { db: fake };
});

import * as departments from "@/app/api/admin/departments/route";
import * as departmentItem from "@/app/api/admin/departments/[id]/route";
import * as rooms from "@/app/api/admin/rooms/route";
import * as roomItem from "@/app/api/admin/rooms/[id]/route";
import * as doctors from "@/app/api/admin/doctors/route";
import * as doctorItem from "@/app/api/admin/doctors/[id]/route";
import * as sessions from "@/app/api/admin/sessions/route";
import * as sessionItem from "@/app/api/admin/sessions/[id]/route";
import * as users from "@/app/api/admin/users/route";
import * as userItem from "@/app/api/admin/users/[id]/route";
import * as myPassword from "@/app/api/me/password/route";

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: Request, ctx: Ctx) => Promise<Response>;
interface RouteCase {
  label: string;
  method: string;
  handler: Handler;
}

function cases(path: string, mod: Record<string, unknown>, methods: string[]): RouteCase[] {
  return methods.map((method) => ({
    label: `${method} ${path}`,
    method,
    handler: mod[method] as Handler,
  }));
}

// Every route that must be ADMIN only.
const ADMIN_ROUTES: RouteCase[] = [
  ...cases("/api/admin/departments", departments, ["GET", "POST"]),
  ...cases("/api/admin/departments/:id", departmentItem, ["PATCH", "DELETE"]),
  ...cases("/api/admin/rooms", rooms, ["GET", "POST"]),
  ...cases("/api/admin/rooms/:id", roomItem, ["PATCH", "DELETE"]),
  ...cases("/api/admin/doctors", doctors, ["GET", "POST"]),
  ...cases("/api/admin/doctors/:id", doctorItem, ["PATCH", "DELETE"]),
  ...cases("/api/admin/sessions", sessions, ["GET", "POST"]),
  ...cases("/api/admin/sessions/:id", sessionItem, ["PATCH", "DELETE"]),
  ...cases("/api/admin/users", users, ["GET", "POST"]),
  ...cases("/api/admin/users/:id", userItem, ["PATCH", "DELETE"]),
];

function loginAs(role: Role | null, overrides: Record<string, unknown> = {}) {
  if (!role) {
    mocks.auth.mockResolvedValue(null);
    return;
  }
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  mocks.userFindUnique.mockResolvedValue({
    id: "u1",
    name: "Test User",
    role,
    active: true,
    departmentId: null,
    mustChangePassword: false,
    ...overrides,
  });
}

function call(r: { method: string; handler: Handler }, body: unknown = {}, id = "x1") {
  const hasBody = r.method !== "GET" && r.method !== "DELETE";
  return r.handler(
    new Request("http://localhost/api/test", {
      method: r.method,
      headers: { "content-type": "application/json" },
      body: hasBody ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writes.length = 0;
  mocks.userFindMany.mockImplementation(async () => []);
});

describe.each(ADMIN_ROUTES)("$label", (route) => {
  it("401 when not logged in", async () => {
    loginAs(null);
    const res = await call(route);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(mocks.writes).toEqual([]);
  });

  it.each<Role>(["CLERK", "DOCTOR"])("403 for %s, and nothing is written", async (role) => {
    loginAs(role);
    const res = await call(route);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(mocks.writes).toEqual([]);
  });

  it("is allowed for ADMIN (any answer except 401 or 403)", async () => {
    loginAs("ADMIN");
    const res = await call(route);
    expect([401, 403]).not.toContain(res.status);
  });

  it("401 for an ADMIN account that was deactivated after login", async () => {
    loginAs("ADMIN", { active: false });
    expect((await call(route)).status).toBe(401);
  });

  it("403 for an ADMIN who must change the password first", async () => {
    loginAs("ADMIN", { mustChangePassword: true });
    const res = await call(route);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("uses the role in the database, not the one in the session cookie", async () => {
    // The cookie may still say ADMIN, but the database now says CLERK.
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    mocks.userFindUnique.mockResolvedValue({
      id: "u1",
      name: "Demoted",
      role: "CLERK",
      active: true,
      departmentId: null,
      mustChangePassword: false,
    });
    expect((await call(route)).status).toBe(403);
  });
});

describe("POST /api/me/password", () => {
  const route = { method: "POST", handler: myPassword.POST as Handler };

  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await call(route)).status).toBe(401);
  });

  it.each<Role>(["ADMIN", "CLERK", "DOCTOR"])("%s may reach it, even when a password change is forced", async (role) => {
    loginAs(role, { mustChangePassword: true });
    const res = await call(route, {});
    expect(res.status).toBe(400); // passes the role check, then fails validation of the empty body
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("401 for a deactivated user", async () => {
    loginAs("CLERK", { active: false });
    expect((await call(route)).status).toBe(401);
  });
});

describe("admin input rules (ADMIN logged in)", () => {
  beforeEach(() => loginAs("ADMIN"));

  it("rejects a malformed JSON body", async () => {
    const res = await departments.POST(
      new Request("http://localhost/api/test", { method: "POST", body: "{not json" }),
      undefined,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_JSON");
  });

  it("rejects a token prefix that is not 2 to 5 letters", async () => {
    const res = await call(
      { method: "POST", handler: departments.POST as Handler },
      { nameEn: "Medicine", nameHi: "चिकित्सा", tokenPrefix: "M1" },
    );
    expect(res.status).toBe(400);
  });

  it("does not let the prefix of an existing department change", async () => {
    const res = await call({ method: "PATCH", handler: departmentItem.PATCH as Handler }, { tokenPrefix: "XYZ" });
    expect(res.status).toBe(400);
  });

  it("rejects a session that ends before it starts", async () => {
    const res = await call(
      { method: "POST", handler: sessions.POST as Handler },
      { departmentId: "d1", weekday: 1, startTime: "13:00", endTime: "09:00" },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/after start/i);
  });

  it("rejects a weak password for a new user", async () => {
    const res = await call(
      { method: "POST", handler: users.POST as Handler },
      { name: "New Clerk", phone: "9876543210", password: "short", role: "CLERK" },
    );
    expect(res.status).toBe(400);
  });

  it("does not let an admin demote or deactivate themselves", async () => {
    const patch = { method: "PATCH", handler: userItem.PATCH as Handler };
    const own = "u1";
    const r1 = await call(patch, { active: false }, own);
    expect(r1.status).toBe(400);
    expect((await r1.json()).error.code).toBe("SELF_LOCKOUT");
    const r2 = await call(patch, { role: "CLERK" }, own);
    expect((await r2.json()).error.code).toBe("SELF_LOCKOUT");
  });

  it("never selects password hashes when listing users", async () => {
    await call({ method: "GET", handler: users.GET as Handler });
    expect(mocks.userFindMany).toHaveBeenCalledTimes(1);
    const arg = (mocks.userFindMany.mock.calls[0] as unknown[])[0] as { select?: Record<string, boolean> };
    expect(arg.select).toBeDefined();
    expect(arg.select).not.toHaveProperty("passwordHash");
  });
});
