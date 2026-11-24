import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The session, database, token creation and the Postgres listener are faked, so these tests check
// the access rules, limits and responses of the realtime and check-in routes.
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
    createToken: vi.fn(),
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
  createToken: mocks.createToken,
  hospitalToday: async () => new Date("2026-11-24T00:00:00.000Z"),
}));
vi.mock("@/lib/display-service", () => ({ getDisplayState: mocks.getDisplayState }));
vi.mock("@/lib/sse", () => ({ subscribeQueue: mocks.subscribe }));

import * as stream from "@/app/api/stream/[departmentId]/route";
import * as display from "@/app/api/display/[departments]/route";
import * as checkin from "@/app/api/checkin/route";

const KEY = "test-display-key-1";
const DEPT = "cmdept000000000000001";
const decoder = new TextDecoder();

type Role = "ADMIN" | "CLERK" | "DOCTOR";
function loginAs(role: Role | null) {
  if (!role) {
    mocks.auth.mockResolvedValue(null);
    return;
  }
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  mocks.fn("user.findUnique").mockResolvedValue({
    id: "u1",
    name: "Test",
    role,
    active: true,
    departmentId: null,
    mustChangePassword: false,
  });
}

const get = (handler: unknown, departments: string, query = "") =>
  (handler as (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>)(
    new Request(`http://localhost/api/x${query}`),
    { params: Promise.resolve({ departmentId: departments, departments }) },
  );

const post = (body: unknown, headers: Record<string, string> = {}) =>
  checkin.POST(
    new Request("http://localhost/api/checkin", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    undefined,
  );

beforeAll(() => {
  process.env.DISPLAY_KEY = KEY;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fns.clear();
  mocks.subscribe.mockImplementation(() => vi.fn());
  mocks.fn("department.count").mockResolvedValue(1);
});

afterEach(() => vi.restoreAllMocks());

describe("GET /api/stream/:departmentId", () => {
  it("401 with no login and no display key", async () => {
    loginAs(null);
    expect((await get(stream.GET, DEPT)).status).toBe(401);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("401 with a wrong display key", async () => {
    loginAs(null);
    expect((await get(stream.GET, DEPT, "?key=wrong-key-123456")).status).toBe(401);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("opens an event stream for a valid display key without any login", async () => {
    loginAs(null);
    const res = await get(stream.GET, DEPT, `?key=${KEY}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-transform");
    expect(mocks.subscribe).toHaveBeenCalledWith([DEPT], expect.any(Function));
    await res.body?.cancel();
  });

  it.each<Role>(["ADMIN", "CLERK", "DOCTOR"])("opens an event stream for a logged-in %s", async (role) => {
    loginAs(role);
    const res = await get(stream.GET, DEPT);
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });

  it("says ready first, then passes queue events on, then stops listening when the client leaves", async () => {
    loginAs("CLERK");
    const unsubscribe = vi.fn();
    mocks.subscribe.mockImplementation(() => unsubscribe);
    const res = await get(stream.GET, DEPT);
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();

    const first = decoder.decode((await reader.read()).value);
    const second = decoder.decode((await reader.read()).value);
    expect(first).toBe("retry: 3000\n\n");
    expect(second).toContain("event: ready");

    const listener = mocks.subscribe.mock.calls[0]?.[1] as (id: string, m: object) => void;
    listener(DEPT, { type: "token", action: "call", label: "MED-034" });
    const third = decoder.decode((await reader.read()).value);
    expect(third).toContain("event: queue");
    expect(third).toContain('"label":"MED-034"');
    expect(third).toContain(`"departmentId":"${DEPT}"`);

    await reader.cancel();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("can follow several departments at once", async () => {
    loginAs("CLERK");
    mocks.fn("department.count").mockResolvedValue(2);
    const res = await get(stream.GET, "cmdept000000000000001,cmdept000000000000002");
    expect(mocks.subscribe).toHaveBeenCalledWith(["cmdept000000000000001", "cmdept000000000000002"], expect.any(Function));
    await res.body?.cancel();
  });

  it("404 for a department that does not exist", async () => {
    loginAs("CLERK");
    mocks.fn("department.count").mockResolvedValue(0);
    expect((await get(stream.GET, DEPT)).status).toBe(404);
  });

  it("400 for a malformed department list", async () => {
    loginAs("CLERK");
    expect((await get(stream.GET, "x;y")).status).toBe(400);
  });
});

describe("GET /api/display/:departments", () => {
  beforeEach(() => mocks.getDisplayState.mockResolvedValue({ rooms: [], waitingTotal: 0, serverTime: "now" }));

  it("401 with no login and no key", async () => {
    loginAs(null);
    expect((await get(display.GET, DEPT)).status).toBe(401);
    expect(mocks.getDisplayState).not.toHaveBeenCalled();
  });

  it("401 with a wrong key", async () => {
    loginAs(null);
    expect((await get(display.GET, DEPT, "?key=nope-nope-nope")).status).toBe(401);
  });

  it("answers a valid key and is never cached", async () => {
    loginAs(null);
    const res = await get(display.GET, DEPT, `?key=${KEY}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getDisplayState).toHaveBeenCalledWith([DEPT]);
  });

  it("answers a logged-in user without a key", async () => {
    loginAs("ADMIN");
    expect((await get(display.GET, DEPT)).status).toBe(200);
  });

  it("is refused when DISPLAY_KEY is not set, whatever key is sent", async () => {
    loginAs(null);
    const saved = process.env.DISPLAY_KEY;
    delete process.env.DISPLAY_KEY;
    expect((await get(display.GET, DEPT, "?key=")).status).toBe(401);
    expect((await get(display.GET, DEPT, `?key=${KEY}`)).status).toBe(401);
    process.env.DISPLAY_KEY = saved;
  });
});

describe("POST /api/checkin (public)", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    name: "Sita Devi",
    phone: "98765 43210",
    age: 34,
    sex: "F",
    departmentId: DEPT,
    consent: true,
    ...over,
  });

  beforeEach(() => {
    mocks.fn("token.count").mockResolvedValue(0);
    mocks.fn("auditLog.count").mockResolvedValue(0);
    mocks.fn("department.findUnique").mockResolvedValue({ active: true });
    mocks.fn("token.findFirst").mockResolvedValue(null);
    mocks.fn("patient.findFirst").mockResolvedValue(null);
    mocks.fn("patient.create").mockResolvedValue({ id: "p1" });
    mocks.createToken.mockResolvedValue({ id: "t1", code: "ABCD2345", label: "MED-001" });
  });

  it("needs no login", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("returns only the public code", async () => {
    const data = await (await post(body())).json();
    expect(data).toEqual({ code: "ABCD2345", existing: false });
  });

  it.each([
    ["no consent", { consent: false }],
    ["a bad phone number", { phone: "12345" }],
    ["an impossible age", { age: 130 }],
    ["no name", { name: "  " }],
    ["a bad sex value", { sex: "X" }],
    ["an extra field", { priority: "EMERGENCY" }],
  ])("400 for %s", async (_label, over) => {
    const res = await post(body(over));
    expect(res.status).toBe(400);
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("cannot be used to ask for a higher priority", async () => {
    await post(body({ age: 30 }));
    expect(mocks.createToken.mock.calls[0]?.[0]).toMatchObject({ priority: "NORMAL", doctorId: null });
  });

  it("puts patients of 60 and over in the elderly queue", async () => {
    await post(body({ age: 71 }));
    expect(mocks.createToken.mock.calls[0]?.[0]).toMatchObject({ priority: "ELDERLY" });
  });

  it("creates the token as a self check-in with no staff member", async () => {
    await post(body());
    const [input, actor, , source] = mocks.createToken.mock.calls[0] as unknown[];
    expect(input).toMatchObject({ departmentId: DEPT, consent: true, patientId: "p1", visitType: "NEW" });
    expect(actor).toBeNull();
    expect(source).toBe("SELF");
    expect(mocks.fn("auditLog.create")).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "checkin", entity: "Token" }) }),
    );
  });

  it("stores the phone number without spaces", async () => {
    await post(body());
    expect(mocks.fn("patient.create")).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: "9876543210" }) }),
    );
  });

  it("reuses the patient when the same person checks in again", async () => {
    mocks.fn("patient.findFirst").mockResolvedValue({ id: "old-patient" });
    await post(body());
    expect(mocks.fn("patient.create")).not.toHaveBeenCalled();
    expect(mocks.createToken.mock.calls[0]?.[0]).toMatchObject({ patientId: "old-patient" });
  });

  it("returns the existing token instead of creating a second one", async () => {
    mocks.fn("token.findFirst").mockResolvedValue({ code: "OLDCODE2" });
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "OLDCODE2", existing: true });
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("429 after 5 check-ins from one phone number in a day", async () => {
    mocks.fn("token.count").mockResolvedValue(5);
    const res = await post(body());
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("still allows the 5th check-in of the day", async () => {
    mocks.fn("token.count").mockResolvedValue(4);
    expect((await post(body())).status).toBe(201);
  });

  it("429 after 30 check-ins from one IP in an hour", async () => {
    mocks.fn("auditLog.count").mockResolvedValue(30);
    const res = await post(body(), { "x-forwarded-for": "203.0.113.9" });
    expect(res.status).toBe(429);
    expect(mocks.fn("auditLog.count")).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: "checkin", ip: "203.0.113.9" }) }),
    );
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("applies the IP limit only when the IP is known", async () => {
    mocks.fn("auditLog.count").mockResolvedValue(99);
    expect((await post(body())).status).toBe(201); // no x-forwarded-for header
    expect(mocks.fn("auditLog.count")).not.toHaveBeenCalled();
  });

  it("400 for a department that is missing or switched off", async () => {
    mocks.fn("department.findUnique").mockResolvedValue({ active: false });
    expect((await post(body())).status).toBe(400);
    mocks.fn("department.findUnique").mockResolvedValue(null);
    expect((await post(body())).status).toBe(400);
    expect(mocks.createToken).not.toHaveBeenCalled();
  });
});
