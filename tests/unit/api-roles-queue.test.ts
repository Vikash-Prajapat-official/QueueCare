import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_ROLES } from "@/lib/queue";
import { ROLES, type Role } from "@/lib/rbac";

// The session and the database are faked so these tests check the role and ownership rules of
// the queue routes. The queue rules themselves are tested in queue.test.ts.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  doctorFindUnique: vi.fn(),
  tokenFindUnique: vi.fn(),
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
          if (modelName === "doctor" && method === "findUnique") return mocks.doctorFindUnique;
          if (modelName === "token" && method === "findUnique") return mocks.tokenFindUnique;
          return async () => {
            if (WRITES.has(method)) mocks.writes.push(`${modelName}.${method}`);
            return method === "findMany" ? [] : null;
          };
        },
      },
    );
  const fake: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string): unknown => {
      if (prop === "$transaction") return async (fn: (tx: unknown) => unknown) => fn(fake);
      if (prop === "$queryRaw") return async () => [{ id: "d1" }]; // department lock and NOTIFY
      return model(prop);
    },
  });
  return { db: fake };
});

import * as departments from "@/app/api/departments/route";
import * as tokens from "@/app/api/tokens/route";
import * as tokenAction from "@/app/api/tokens/[id]/[action]/route";
import * as tokenStatus from "@/app/api/tokens/[id]/status/route";
import * as queue from "@/app/api/queue/[departmentId]/route";
import * as queueNext from "@/app/api/queue/[departmentId]/next/route";
import * as patientSearch from "@/app/api/patients/search/route";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

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

function call(handler: unknown, params: Record<string, string> = {}, init: { method?: string; body?: unknown; url?: string } = {}) {
  const method = init.method ?? "GET";
  return (handler as Handler)(
    new Request(init.url ?? "http://localhost/api/test", {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
    }),
    { params: Promise.resolve(params) },
  );
}

const code = async (res: Response) => (await res.json()).error?.code as string | undefined;
const notAuthRefusal = (status: number) => expect([401, 403]).not.toContain(status);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writes.length = 0;
  mocks.doctorFindUnique.mockResolvedValue(null);
  mocks.tokenFindUnique.mockResolvedValue(null);
});

describe("GET /api/departments", () => {
  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await call(departments.GET)).status).toBe(401);
  });

  it.each(ROLES)("is open to %s", async (role) => {
    loginAs(role);
    expect((await call(departments.GET)).status).toBe(200);
  });

  it("403 until a forced password change is done", async () => {
    loginAs("CLERK", { mustChangePassword: true });
    expect((await call(departments.GET)).status).toBe(403);
  });
});

describe("POST /api/tokens", () => {
  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await call(tokens.POST, {}, { method: "POST" })).status).toBe(401);
  });

  it("403 for a doctor, and nothing is written", async () => {
    loginAs("DOCTOR");
    const res = await call(tokens.POST, {}, { method: "POST" });
    expect(res.status).toBe(403);
    expect(mocks.writes).toEqual([]);
  });

  it.each<Role>(["CLERK", "ADMIN"])("%s passes the role check (empty body then fails validation)", async (role) => {
    loginAs(role);
    const res = await call(tokens.POST, {}, { method: "POST" });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("VALIDATION");
  });

  it("refuses a token without the patient's consent", async () => {
    loginAs("CLERK");
    const res = await call(
      tokens.POST,
      {},
      {
        method: "POST",
        body: {
          departmentId: "d1",
          consent: false,
          patient: { name: "A Patient", phone: "9876543210", age: 30, sex: "F" },
        },
      },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/consent/i);
  });

  it("needs exactly one of patientId or patient", async () => {
    loginAs("CLERK");
    const both = await call(
      tokens.POST,
      {},
      {
        method: "POST",
        body: {
          departmentId: "d1",
          consent: true,
          patientId: "p1",
          patient: { name: "A Patient", phone: "9876543210", age: 30, sex: "F" },
        },
      },
    );
    const neither = await call(tokens.POST, {}, { method: "POST", body: { departmentId: "d1", consent: true } });
    expect(both.status).toBe(400);
    expect(neither.status).toBe(400);
  });
});

describe("POST /api/tokens/:id/:action", () => {
  const actions = ["skip", "recall", "no-show", "start", "complete", "transfer", "cancel"] as const;

  describe.each(actions)("%s", (action) => {
    it("401 when not logged in", async () => {
      loginAs(null);
      expect((await call(tokenAction.POST, { id: "t1", action }, { method: "POST" })).status).toBe(401);
    });

    it.each(ROLES)("%s is allowed or refused exactly as the action table says", async (role) => {
      loginAs(role);
      const res = await call(tokenAction.POST, { id: "t1", action }, { method: "POST", body: { doctorId: null } });
      if (ACTION_ROLES[action].includes(role)) {
        notAuthRefusal(res.status);
      } else {
        expect(res.status).toBe(403);
        expect(mocks.writes).toEqual([]);
      }
    });
  });

  it("knows no action called next or anything else", async () => {
    loginAs("ADMIN");
    for (const action of ["next", "delete", "reopen"]) {
      expect((await call(tokenAction.POST, { id: "t1", action }, { method: "POST" })).status).toBe(404);
    }
  });

  describe("ownership and move rules", () => {
    const token = (over: Record<string, unknown> = {}) => ({
      id: "t1",
      seqNo: 5,
      priority: "NORMAL",
      status: "CALLED",
      skipHold: 0,
      doctorId: "doc-other",
      departmentId: "d1",
      date: new Date("2026-11-24T00:00:00Z"),
      skipCount: 0,
      recallCount: 0,
      ...over,
    });

    it("a doctor cannot act on a patient called by another doctor", async () => {
      loginAs("DOCTOR");
      mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d1", displayName: "Dr Me" });
      mocks.tokenFindUnique.mockResolvedValue(token());
      const res = await call(tokenAction.POST, { id: "t1", action: "complete" }, { method: "POST" });
      expect(res.status).toBe(403);
      expect(await code(res)).toBe("NOT_YOUR_PATIENT");
      expect(mocks.writes).toEqual([]);
    });

    it("a doctor cannot act in another department", async () => {
      loginAs("DOCTOR");
      mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d2", displayName: "Dr Me" });
      mocks.tokenFindUnique.mockResolvedValue(token());
      const res = await call(tokenAction.POST, { id: "t1", action: "start" }, { method: "POST" });
      expect(res.status).toBe(403);
      expect(mocks.writes).toEqual([]);
    });

    it("a doctor without a doctor profile is refused", async () => {
      loginAs("DOCTOR");
      mocks.tokenFindUnique.mockResolvedValue(token());
      const res = await call(tokenAction.POST, { id: "t1", action: "start" }, { method: "POST" });
      expect(res.status).toBe(403);
      expect(await code(res)).toBe("NO_DOCTOR_PROFILE");
    });

    it("a doctor can act on their own patient", async () => {
      loginAs("DOCTOR");
      mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d1", displayName: "Dr Me" });
      mocks.tokenFindUnique.mockResolvedValue(token({ doctorId: "doc-me", status: "IN_CONSULT" }));
      const res = await call(tokenAction.POST, { id: "t1", action: "complete" }, { method: "POST" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ token: { id: "t1", status: "DONE" } });
      expect(mocks.writes).toEqual(expect.arrayContaining(["token.update", "queueEvent.create", "auditLog.create"]));
    });

    it("refuses a move the rules do not allow, and writes nothing", async () => {
      loginAs("CLERK");
      mocks.tokenFindUnique.mockResolvedValue(token({ status: "WAITING" }));
      const res = await call(tokenAction.POST, { id: "t1", action: "complete" }, { method: "POST" });
      expect(res.status).toBe(409);
      expect(await code(res)).toBe("INVALID_MOVE");
      expect(mocks.writes).toEqual([]);
    });

    it("does not cancel a finished token", async () => {
      loginAs("CLERK");
      mocks.tokenFindUnique.mockResolvedValue(token({ status: "DONE" }));
      const res = await call(tokenAction.POST, { id: "t1", action: "cancel" }, { method: "POST" });
      expect(res.status).toBe(409);
    });

    it("lets the desk cancel a waiting token", async () => {
      loginAs("CLERK");
      mocks.tokenFindUnique.mockResolvedValue(token({ status: "WAITING", doctorId: null }));
      const res = await call(tokenAction.POST, { id: "t1", action: "cancel" }, { method: "POST" });
      expect(res.status).toBe(200);
      expect((await res.json()).token.status).toBe("CANCELLED");
    });

    it("a skipped patient with nobody else waiting goes straight back to waiting", async () => {
      loginAs("DOCTOR");
      mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d1", displayName: "Dr Me" });
      mocks.tokenFindUnique.mockResolvedValue(token({ doctorId: "doc-me" }));
      const res = await call(tokenAction.POST, { id: "t1", action: "skip" }, { method: "POST" });
      expect(res.status).toBe(200);
      expect((await res.json()).token.status).toBe("WAITING");
    });

    it("transfer needs a doctorId field", async () => {
      loginAs("CLERK");
      mocks.tokenFindUnique.mockResolvedValue(token({ status: "WAITING", doctorId: null }));
      const res = await call(tokenAction.POST, { id: "t1", action: "transfer" }, { method: "POST", body: {} });
      expect(res.status).toBe(400);
    });
  });
});

describe("GET /api/tokens/:code/status (public)", () => {
  it("needs no login", async () => {
    loginAs(null);
    const res = await call(tokenStatus.GET, { id: "ABCD2345" });
    notAuthRefusal(res.status);
    expect(res.status).toBe(404); // the fake database has no such token
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("answers 404 for a code that cannot exist", async () => {
    expect((await call(tokenStatus.GET, { id: "short" })).status).toBe(404);
    expect((await call(tokenStatus.GET, { id: "ABCD234!" })).status).toBe(404);
  });
});

describe("GET /api/queue/:departmentId", () => {
  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await call(queue.GET, { departmentId: "d1" })).status).toBe(401);
  });

  it.each<Role>(["CLERK", "ADMIN"])("%s may read any department", async (role) => {
    loginAs(role);
    const res = await call(queue.GET, { departmentId: "d1" });
    notAuthRefusal(res.status);
    expect(res.status).toBe(404); // the fake database has no such department
  });

  it("a doctor may read only their own department", async () => {
    loginAs("DOCTOR");
    mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d2" });
    expect((await call(queue.GET, { departmentId: "d1" })).status).toBe(403);
    mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d1" });
    notAuthRefusal((await call(queue.GET, { departmentId: "d1" })).status);
  });

  it("a doctor with no profile is refused", async () => {
    loginAs("DOCTOR");
    expect((await call(queue.GET, { departmentId: "d1" })).status).toBe(403);
  });
});

describe("POST /api/queue/:departmentId/next", () => {
  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await call(queueNext.POST, { departmentId: "d1" }, { method: "POST" })).status).toBe(401);
  });

  it.each<Role>(["CLERK", "ADMIN"])("403 for %s: only a doctor calls the next patient", async (role) => {
    loginAs(role);
    const res = await call(queueNext.POST, { departmentId: "d1" }, { method: "POST" });
    expect(res.status).toBe(403);
    expect(mocks.writes).toEqual([]);
  });

  it("a doctor with no profile is refused", async () => {
    loginAs("DOCTOR");
    const res = await call(queueNext.POST, { departmentId: "d1" }, { method: "POST" });
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("NO_DOCTOR_PROFILE");
  });

  it("a doctor cannot call patients of another department", async () => {
    loginAs("DOCTOR");
    mocks.doctorFindUnique.mockResolvedValue({ id: "doc-me", departmentId: "d2", displayName: "Dr Me" });
    const res = await call(queueNext.POST, { departmentId: "d1" }, { method: "POST" });
    expect(res.status).toBe(403);
    expect(mocks.writes).toEqual([]);
  });
});

describe("GET /api/patients/search", () => {
  const url = (phone?: string) => `http://localhost/api/patients/search${phone ? `?phone=${phone}` : ""}`;

  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await call(patientSearch.GET, {}, { url: url("9876543210") })).status).toBe(401);
  });

  it("403 for a doctor", async () => {
    loginAs("DOCTOR");
    expect((await call(patientSearch.GET, {}, { url: url("9876543210") })).status).toBe(403);
  });

  it.each<Role>(["CLERK", "ADMIN"])("%s may search by a full phone number", async (role) => {
    loginAs(role);
    const res = await call(patientSearch.GET, {}, { url: url("9876543210") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("refuses a partial number so the patient list cannot be browsed", async () => {
    loginAs("CLERK");
    expect((await call(patientSearch.GET, {}, { url: url("98765") })).status).toBe(400);
    expect((await call(patientSearch.GET, {}, { url: url() })).status).toBe(400);
  });
});
