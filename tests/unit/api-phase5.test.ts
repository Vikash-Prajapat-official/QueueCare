import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllLimits } from "@/lib/rate-limit";

// Session, database and services are faked: these tests check role rules, input rules and rate limits.
const mocks = vi.hoisted(() => {
  const fns = new Map<string, ReturnType<typeof vi.fn>>();
  const fn = (name: string) => {
    let f = fns.get(name);
    if (!f) {
      f = vi.fn(async () => null);
      fns.set(name, f);
    }
    return f;
  };
  return {
    fn,
    fns,
    auth: vi.fn(),
    getReport: vi.fn(),
    tokensCsvStream: vi.fn(),
    findPatientsForAdmin: vi.fn(),
    exportPatientData: vi.fn(),
    erasePatient: vi.fn(),
    getTokenStatusByCode: vi.fn(),
    getDisplayState: vi.fn(),
    subscribe: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    { get: (_t, model: string) => new Proxy({}, { get: (_m, method: string) => mocks.fn(`${model}.${method}`) }) },
  ),
}));
vi.mock("@/lib/queue-service", () => ({
  hospitalToday: async () => new Date("2026-11-24T00:00:00.000Z"),
  getTokenStatusByCode: mocks.getTokenStatusByCode,
  createToken: vi.fn(),
}));
vi.mock("@/lib/report-service", () => ({
  getReport: mocks.getReport,
  tokensCsvStream: mocks.tokensCsvStream,
  hospitalTimezone: async () => "Asia/Kolkata",
}));
vi.mock("@/lib/patient-privacy", () => ({
  findPatientsForAdmin: mocks.findPatientsForAdmin,
  exportPatientData: mocks.exportPatientData,
  erasePatient: mocks.erasePatient,
}));
vi.mock("@/lib/display-service", () => ({ getDisplayState: mocks.getDisplayState }));
vi.mock("@/lib/sse", () => ({ subscribeQueue: mocks.subscribe }));

import * as reports from "@/app/api/reports/daily/route";
import * as csv from "@/app/api/export/tokens.csv/route";
import * as patients from "@/app/api/admin/patients/route";
import * as patientItem from "@/app/api/admin/patients/[id]/route";
import * as patientExport from "@/app/api/admin/patients/[id]/export/route";
import * as tokenStatus from "@/app/api/tokens/[id]/status/route";
import * as checkin from "@/app/api/checkin/route";
import * as display from "@/app/api/display/[departments]/route";
import * as myPassword from "@/app/api/me/password/route";

type Role = "ADMIN" | "CLERK" | "DOCTOR";
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

function loginAs(role: Role | null, over: Record<string, unknown> = {}) {
  if (!role) return void mocks.auth.mockResolvedValue(null);
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  mocks.fn("user.findUnique").mockResolvedValue({
    id: "u1",
    name: "Test",
    role,
    active: true,
    departmentId: null,
    mustChangePassword: false,
    passwordHash: bcrypt.hashSync("right-password", 4),
    ...over,
  });
}

const call = (handler: unknown, url = "http://localhost/api/x", init: RequestInit = {}, params: Record<string, string> = {}) =>
  (handler as Handler)(new Request(url, init), { params: Promise.resolve(params) });

const body = (b: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(b),
});

beforeAll(() => {
  process.env.DISPLAY_KEY = "test-display-key-1";
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fns.clear();
  clearAllLimits();
  mocks.getReport.mockResolvedValue({ days: [], totals: {} });
  mocks.tokensCsvStream.mockReturnValue(new ReadableStream({ start: (c) => (c.enqueue(new TextEncoder().encode("a,b\r\n")), c.close()) }));
  mocks.findPatientsForAdmin.mockResolvedValue([]);
  mocks.exportPatientData.mockResolvedValue({ patient: { id: "p1" } });
  mocks.erasePatient.mockResolvedValue(undefined);
  mocks.getTokenStatusByCode.mockResolvedValue({ code: "ABCD2345" });
  mocks.fn("department.count").mockResolvedValue(1);
});

// ------------------------------------------------------------------------------ role rules

const ADMIN_ONLY: { label: string; run: () => Promise<Response> }[] = [
  { label: "GET /api/reports/daily", run: () => call(reports.GET) },
  { label: "GET /api/export/tokens.csv", run: () => call(csv.GET) },
  { label: "GET /api/admin/patients", run: () => call(patients.GET, "http://localhost/api/x?phone=9876543210") },
  { label: "DELETE /api/admin/patients/:id", run: () => call(patientItem.DELETE, "http://localhost/api/x", { method: "DELETE" }, { id: "p1" }) },
  { label: "GET /api/admin/patients/:id/export", run: () => call(patientExport.GET, "http://localhost/api/x", {}, { id: "p1" }) },
];

describe.each(ADMIN_ONLY)("$label", ({ run }) => {
  it("401 when not logged in", async () => {
    loginAs(null);
    expect((await run()).status).toBe(401);
  });

  it.each<Role>(["CLERK", "DOCTOR"])("403 for %s, and nothing is read or changed", async (role) => {
    loginAs(role);
    expect((await run()).status).toBe(403);
    for (const fn of [mocks.getReport, mocks.tokensCsvStream, mocks.findPatientsForAdmin, mocks.exportPatientData, mocks.erasePatient]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("is allowed for ADMIN", async () => {
    loginAs("ADMIN");
    expect((await run()).status).toBe(200);
  });

  it("403 for an ADMIN who must change the password first", async () => {
    loginAs("ADMIN", { mustChangePassword: true });
    expect((await run()).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------------- reports

describe("GET /api/reports/daily", () => {
  beforeEach(() => loginAs("ADMIN"));

  it("covers the last 7 days when no dates are given", async () => {
    await call(reports.GET);
    expect(mocks.getReport).toHaveBeenCalledWith("2026-11-18", "2026-11-24");
  });

  it("uses the dates given and is never cached", async () => {
    const res = await call(reports.GET, "http://localhost/api/x?from=2026-11-01&to=2026-11-10");
    expect(mocks.getReport).toHaveBeenCalledWith("2026-11-01", "2026-11-10");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["a bad date", "from=2026-13-40"],
    ["a reversed range", "from=2026-11-10&to=2026-11-01"],
    ["more than 92 days", "from=2026-01-01&to=2026-11-24"],
  ])("400 for %s", async (_label, query) => {
    const res = await call(reports.GET, `http://localhost/api/x?${query}`);
    expect(res.status).toBe(400);
    expect(mocks.getReport).not.toHaveBeenCalled();
  });
});

describe("GET /api/export/tokens.csv", () => {
  beforeEach(() => loginAs("ADMIN"));

  it("sends a CSV file for download", async () => {
    const res = await call(csv.GET, "http://localhost/api/x?from=2026-11-01&to=2026-11-10");
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="queuecare-tokens-2026-11-01-to-2026-11-10.csv"');
    expect(await res.text()).toBe("a,b\r\n");
    expect(mocks.tokensCsvStream).toHaveBeenCalledWith("2026-11-01", "2026-11-10", "Asia/Kolkata");
  });

  it("writes the export to the audit log", async () => {
    await call(csv.GET, "http://localhost/api/x?from=2026-11-01&to=2026-11-10");
    expect(mocks.fn("auditLog.create")).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "export.tokens", entityId: "2026-11-01..2026-11-10", actorUserId: "u1" }),
    });
  });

  it("allows up to 366 days but not more", async () => {
    expect((await call(csv.GET, "http://localhost/api/x?from=2025-11-24&to=2026-11-24")).status).toBe(200); // 366 days
    expect((await call(csv.GET, "http://localhost/api/x?from=2025-11-23&to=2026-11-24")).status).toBe(400); // 367 days
  });
});

// ------------------------------------------------------------------------- patient data rights

describe("patient privacy routes", () => {
  beforeEach(() => loginAs("ADMIN"));

  it("search needs the full phone number", async () => {
    expect((await call(patients.GET, "http://localhost/api/x?phone=98765")).status).toBe(400);
    expect((await call(patients.GET, "http://localhost/api/x")).status).toBe(400);
    expect(mocks.findPatientsForAdmin).not.toHaveBeenCalled();
  });

  it("search normalises the number and does not log it", async () => {
    await call(patients.GET, "http://localhost/api/x?phone=%2B91%2098765%2043210");
    expect(mocks.findPatientsForAdmin).toHaveBeenCalledWith("9876543210");
    const logged = JSON.stringify(mocks.fn("auditLog.create").mock.calls);
    expect(logged).toContain("patient.lookup");
    expect(logged).not.toContain("9876543210");
  });

  it("export sends the data as a download and logs it", async () => {
    const res = await call(patientExport.GET, "http://localhost/api/x", {}, { id: "p1" });
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(await res.json()).toEqual({ patient: { id: "p1" } });
    expect(mocks.fn("auditLog.create")).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "patient.export", entityId: "p1" }) });
  });

  it("erase calls the erase and logs it", async () => {
    await call(patientItem.DELETE, "http://localhost/api/x", { method: "DELETE" }, { id: "p1" });
    expect(mocks.erasePatient).toHaveBeenCalledWith("p1");
    expect(mocks.fn("auditLog.create")).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "patient.erase", entityId: "p1" }) });
  });
});

// ------------------------------------------------------------------------------- rate limits

describe("rate limits on public routes", () => {
  const ip = { "x-forwarded-for": "203.0.113.7" };
  const statusCall = (code = "ABCD2345", headers: Record<string, string> = ip) =>
    call(tokenStatus.GET, "http://localhost/api/x", { headers }, { id: code });

  it("lets a status page poll every 5 seconds without trouble", async () => {
    for (let i = 0; i < 12; i++) expect((await statusCall()).status).toBe(200);
  });

  it("limits one token code to 60 status requests a minute, with Retry-After", async () => {
    for (let i = 0; i < 60; i++) expect((await statusCall()).status).toBe(200);
    const res = await statusCall();
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await statusCall("ZZZZ2345")).status).toBe(200); // another code is not affected
  });

  it("limits one visitor to 120 status requests a minute, however many codes they try", async () => {
    let refused = 0;
    for (let i = 0; i < 130; i++) {
      const res = await statusCall(`CODE${String(i).padStart(4, "2")}`);
      if (res.status === 429) refused++;
    }
    expect(refused).toBe(10);
    expect((await statusCall("ABCD2345", { "x-forwarded-for": "198.51.100.9" })).status).toBe(200); // another visitor is fine
  });

  it("gives visitors with an unknown IP a shared bucket that is 10 times bigger", async () => {
    let ok = 0;
    for (let i = 0; i < 1250; i++) {
      const res = await statusCall(`CODE${String(i).padStart(4, "2")}`, {});
      if (res.status === 200) ok++;
    }
    expect(ok).toBe(1200);
  });

  it("limits check-in attempts to 10 a minute per visitor", async () => {
    const attempt = () => checkin.POST(new Request("http://localhost/api/checkin", body({}, ip)), undefined);
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(400); // invalid body, but counted
    const res = await attempt();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("limits wrong display keys to 20 a minute, but a right key always works", async () => {
    loginAs(null);
    const wrong = () => call(display.GET, "http://localhost/api/x?key=wrong-key-123456", { headers: ip }, { departments: "cmdept000000000000001" });
    for (let i = 0; i < 20; i++) expect((await wrong()).status).toBe(401);
    expect((await wrong()).status).toBe(429);
    mocks.getDisplayState.mockResolvedValue({ rooms: [] });
    const right = await call(display.GET, "http://localhost/api/x?key=test-display-key-1", { headers: ip }, { departments: "cmdept000000000000001" });
    expect(right.status).toBe(200);
  });

  it("limits password-change tries to 10 per 15 minutes per user", async () => {
    loginAs("CLERK");
    const attempt = () => myPassword.POST(new Request("http://localhost/api/me/password", body({ currentPassword: "wrong-password", newPassword: "new-password-1" })), undefined);
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(400);
    expect((await attempt()).status).toBe(429);
  });

  it("does not use up the budget of people who are not the one guessing", async () => {
    loginAs("CLERK");
    const attempt = () => myPassword.POST(new Request("http://localhost/api/me/password", body({ currentPassword: "wrong-password", newPassword: "new-password-1" })), undefined);
    for (let i = 0; i < 11; i++) await attempt();
    loginAs("CLERK", { id: "u2" });
    mocks.auth.mockResolvedValue({ user: { id: "u2" } });
    expect((await attempt()).status).toBe(400); // user u2 starts with a full budget
  });
});
