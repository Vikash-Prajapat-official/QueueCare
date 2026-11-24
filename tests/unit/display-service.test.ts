import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doctorFindMany: vi.fn(),
  tokenFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { doctor: { findMany: mocks.doctorFindMany }, token: { findMany: mocks.tokenFindMany } },
}));
vi.mock("@/lib/queue-service", () => ({ hospitalToday: async () => new Date("2026-11-24T00:00:00.000Z") }));

import { getDisplayState } from "@/lib/display-service";

const med = { nameEn: "Medicine", nameHi: "चिकित्सा", tokenPrefix: "MED", color: "#0F766E" };
const ped = { nameEn: "Paediatrics", nameHi: "बाल रोग", tokenPrefix: "PED", color: "#2563EB" };

const doctor = (id: string, departmentId: string, department: typeof med, room: string | null, displayName = "Dr Test") => ({
  id,
  departmentId,
  displayName,
  room: room ? { name: room } : null,
  department,
});

let n = 0;
const token = (seqNo: number, over: Record<string, unknown> = {}) => ({
  id: `tok${n++}`,
  seqNo,
  priority: "NORMAL",
  status: "WAITING",
  skipHold: 0,
  doctorId: null,
  departmentId: "d1",
  calledAt: null,
  recallCount: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.doctorFindMany.mockResolvedValue([]);
  mocks.tokenFindMany.mockResolvedValue([]);
});

describe("getDisplayState", () => {
  it("has one card per doctor, titled with the room", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4"), doctor("b", "d2", ped, "Room 5")]);
    const state = await getDisplayState(["d1", "d2"]);
    expect(state.rooms.map((r) => [r.title, r.prefix])).toEqual([
      ["Room 4", "MED"],
      ["Room 5", "PED"],
    ]);
  });

  it("falls back to the doctor's display name when there is no room", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, null, "Dr. Anil Sharma")]);
    const [room] = (await getDisplayState(["d1"])).rooms;
    expect(room?.title).toBe("Dr. Anil Sharma");
    expect(room?.roomName).toBeNull();
  });

  it("shows the called patient as the current token with its number", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4")]);
    mocks.tokenFindMany.mockResolvedValue([
      token(34, { status: "CALLED", doctorId: "a", calledAt: new Date("2026-11-24T04:00:00Z"), recallCount: 1 }),
    ]);
    const [room] = (await getDisplayState(["d1"])).rooms;
    expect(room?.current).toMatchObject({ label: "MED-034", seqNo: 34, status: "CALLED", recallCount: 1 });
    expect(room?.current?.calledAt).toBe("2026-11-24T04:00:00.000Z");
  });

  it("prefers a patient being called over one already in consultation", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4")]);
    mocks.tokenFindMany.mockResolvedValue([
      token(10, { status: "IN_CONSULT", doctorId: "a" }),
      token(11, { status: "CALLED", doctorId: "a" }),
    ]);
    expect((await getDisplayState(["d1"])).rooms[0]?.current?.label).toBe("MED-011");
  });

  it("lists the next 3 in call order: priority first, own and unassigned patients only", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4")]);
    mocks.tokenFindMany.mockResolvedValue([
      token(5),
      token(6, { doctorId: "a" }),
      token(7, { doctorId: "other-doctor" }),
      token(8, { priority: "EMERGENCY" }),
      token(9, { priority: "ELDERLY", doctorId: "a" }),
      token(10),
    ]);
    const [room] = (await getDisplayState(["d1"])).rooms;
    expect(room?.next).toEqual(["MED-008", "MED-009", "MED-005"]);
  });

  it("has no current patient and an empty list when nobody is there", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4")]);
    const state = await getDisplayState(["d1"]);
    expect(state.rooms[0]).toMatchObject({ current: null, next: [] });
    expect(state.waitingTotal).toBe(0);
  });

  it("counts waiting and skipped patients in the total", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4")]);
    mocks.tokenFindMany.mockResolvedValue([
      token(1),
      token(2, { status: "SKIPPED", skipHold: 2, doctorId: "a" }),
      token(3, { status: "CALLED", doctorId: "a" }),
    ]);
    expect((await getDisplayState(["d1"])).waitingTotal).toBe(2);
  });

  it("keeps each department's patients apart", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4"), doctor("b", "d2", ped, "Room 5")]);
    mocks.tokenFindMany.mockResolvedValue([token(1, { departmentId: "d1" }), token(1, { departmentId: "d2" }), token(2, { departmentId: "d2" })]);
    const rooms = (await getDisplayState(["d1", "d2"])).rooms;
    expect(rooms.find((r) => r.prefix === "MED")?.next).toEqual(["MED-001"]);
    expect(rooms.find((r) => r.prefix === "PED")?.next).toEqual(["PED-001", "PED-002"]);
  });

  it("only asks for active doctors, today's open tokens, and never for patient data", async () => {
    await getDisplayState(["d1"]);
    const doctorQuery = JSON.stringify(mocks.doctorFindMany.mock.calls[0]?.[0]);
    const tokenQuery = JSON.stringify(mocks.tokenFindMany.mock.calls[0]?.[0]);
    expect(doctorQuery).toContain('"active":true');
    expect(tokenQuery).toContain("2026-11-24");
    for (const query of [doctorQuery, tokenQuery]) {
      expect(query).not.toMatch(/patient|phone|abha/i);
    }
    expect(mocks.tokenFindMany.mock.calls[0]?.[0].select).not.toHaveProperty("patient");
  });

  it("returns nothing that looks like a patient name or phone number", async () => {
    mocks.doctorFindMany.mockResolvedValue([doctor("a", "d1", med, "Room 4")]);
    mocks.tokenFindMany.mockResolvedValue([token(1, { status: "CALLED", doctorId: "a" }), token(2)]);
    const json = JSON.stringify(await getDisplayState(["d1"]));
    expect(json).not.toMatch(/patient|phone|abha|"name"/i);
  });
});
