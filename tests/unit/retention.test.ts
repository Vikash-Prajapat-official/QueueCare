import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ executeRaw: vi.fn(), auditCreate: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { $executeRaw: mocks.executeRaw, auditLog: { create: mocks.auditCreate } },
}));

import { CONSENT_NOTICE_VERSION, consentNotice, retentionDays } from "@/lib/consent";
import { ANONYMISED_NAME, anonymiseExpiredPatients, retentionCutoff } from "@/lib/retention";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeRaw.mockResolvedValue(0);
  mocks.auditCreate.mockResolvedValue({});
});

describe("retentionDays", () => {
  it("reads whole numbers of at least 1", () => {
    expect(retentionDays("30")).toBe(30);
    expect(retentionDays("1")).toBe(1);
  });
  it("uses 90 when the setting is missing or wrong", () => {
    for (const bad of [undefined, "", "0", "-5", "abc", "12.5"]) expect(retentionDays(bad)).toBe(90);
  });
});

describe("retentionCutoff", () => {
  it("is the given number of whole days before now", () => {
    expect(retentionCutoff(new Date("2026-11-24T10:00:00Z"), 90).toISOString()).toBe("2026-08-26T10:00:00.000Z");
    expect(retentionCutoff(new Date("2026-11-24T10:00:00Z"), 1).toISOString()).toBe("2026-11-23T10:00:00.000Z");
  });
});

describe("anonymiseExpiredPatients", () => {
  it("anonymises name, phone and ABHA number only, and keeps the counts", async () => {
    await anonymiseExpiredPatients(new Date("2026-11-24T10:00:00Z"), 90);
    const strings = mocks.executeRaw.mock.calls[0]?.[0] as string[];
    const sql = strings.join("?");
    expect(sql).toMatch(/SET name = \?, phone = '', abha_number = NULL, anonymised = true/);
    expect(sql).toMatch(/WHERE p\.anonymised = false/);
    expect(sql).not.toMatch(/DELETE/i);
    expect(sql).not.toMatch(/\bage\b|\bsex\b/);
  });

  it("measures from the last visit, not only from when the patient was added", async () => {
    await anonymiseExpiredPatients(new Date("2026-11-24T10:00:00Z"), 90);
    const sql = (mocks.executeRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toMatch(/MAX\(t\.created_at\)/);
  });

  it("passes the name to use and the cutoff date", async () => {
    await anonymiseExpiredPatients(new Date("2026-11-24T10:00:00Z"), 90);
    const [, name, cutoff] = mocks.executeRaw.mock.calls[0] as unknown[];
    expect(name).toBe(ANONYMISED_NAME);
    expect((cutoff as Date).toISOString()).toBe("2026-08-26T10:00:00.000Z");
  });

  it("returns how many were anonymised and writes it to the audit log without personal data", async () => {
    mocks.executeRaw.mockResolvedValue(7);
    expect(await anonymiseExpiredPatients(new Date("2026-11-24T10:00:00Z"), 90)).toBe(7);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "retention.run", entity: "Patient", entityId: "anonymised=7 after=90d", actorUserId: null }),
    });
  });

  it("uses RETENTION_DAYS when no number of days is given", async () => {
    const before = process.env.RETENTION_DAYS;
    process.env.RETENTION_DAYS = "30";
    await anonymiseExpiredPatients(new Date("2026-11-24T10:00:00Z"));
    const cutoff = mocks.executeRaw.mock.calls[0]?.[2] as Date;
    expect(cutoff.toISOString()).toBe("2026-10-25T10:00:00.000Z");
    if (before === undefined) delete process.env.RETENTION_DAYS;
    else process.env.RETENTION_DAYS = before;
  });
});

describe("consent notice", () => {
  it("has a version and gives the notice in English and Hindi with the retention period", () => {
    expect(CONSENT_NOTICE_VERSION).toMatch(/^v\d+$/);
    const n = consentNotice(45);
    expect(n.en).toContain("45 days");
    expect(n.hi).toContain("45 दिन");
    expect(n.en).toMatch(/never record your illness/);
  });
});
