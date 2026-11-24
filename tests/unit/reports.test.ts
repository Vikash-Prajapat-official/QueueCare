import { describe, expect, it } from "vitest";
import { MAX_REPORT_DAYS, buildReport, resolveRange, type DepartmentInfo, type ReportToken } from "@/lib/reports";

const med: DepartmentInfo = { id: "med", nameEn: "Medicine", tokenPrefix: "MED" };
const ped: DepartmentInfo = { id: "ped", nameEn: "Paediatrics", tokenPrefix: "PED" };

const at = (hhmm: string, date = "2026-11-24") => new Date(`${date}T${hhmm}:00Z`);

function token(over: Partial<ReportToken> = {}): ReportToken {
  return {
    date: "2026-11-24",
    departmentId: "med",
    status: "DONE",
    source: "DESK",
    createdAt: at("04:00"),
    calledAt: at("04:20"),
    startedAt: at("04:22"),
    completedAt: at("04:30"),
    ...over,
  };
}

describe("resolveRange", () => {
  it("uses the dates given", () => {
    expect(resolveRange("2026-11-01", "2026-11-24", "2026-11-24", 92)).toEqual({ ok: true, from: "2026-11-01", to: "2026-11-24" });
  });

  it("defaults to the last 7 days ending today", () => {
    expect(resolveRange(null, null, "2026-11-24", 92)).toEqual({ ok: true, from: "2026-11-18", to: "2026-11-24" });
    expect(resolveRange(undefined, "2026-11-10", "2026-11-24", 92)).toEqual({ ok: true, from: "2026-11-04", to: "2026-11-10" });
  });

  it("refuses bad dates, a reversed range and too long a range", () => {
    expect(resolveRange("2026-13-01", "2026-11-24", "2026-11-24", 92).ok).toBe(false);
    expect(resolveRange("nope", null, "2026-11-24", 92).ok).toBe(false);
    expect(resolveRange("2026-11-24", "2026-11-01", "2026-11-24", 92).ok).toBe(false);
    const long = resolveRange("2026-01-01", "2026-11-24", "2026-11-24", MAX_REPORT_DAYS);
    expect(long.ok).toBe(false);
    expect(resolveRange("2026-08-25", "2026-11-24", "2026-11-24", MAX_REPORT_DAYS).ok).toBe(true); // exactly 92 days
  });
});

describe("buildReport", () => {
  it("counts tokens by outcome", () => {
    const r = buildReport(
      [
        token(),
        token({ status: "NO_SHOW", startedAt: null, completedAt: null }),
        token({ status: "CANCELLED", calledAt: null, startedAt: null, completedAt: null }),
        token({ status: "WAITING", calledAt: null, startedAt: null, completedAt: null }),
        token({ status: "CALLED", startedAt: null, completedAt: null }),
        token({ source: "SELF" }),
      ],
      [med],
      "2026-11-24",
      "2026-11-24",
    );
    expect(r.totals).toMatchObject({ total: 6, done: 2, noShow: 1, cancelled: 1, open: 2, selfCheckIn: 1 });
  });

  it("averages the wait from token to first call, for patients who were called", () => {
    const r = buildReport(
      [
        token({ createdAt: at("04:00"), calledAt: at("04:10") }), // 10 min
        token({ createdAt: at("04:00"), calledAt: at("04:30") }), // 30 min
        token({ status: "CANCELLED", createdAt: at("04:00"), calledAt: null }), // not counted
        token({ status: "WAITING", createdAt: at("04:00"), calledAt: null }), // not counted
      ],
      [med],
      "2026-11-24",
      "2026-11-24",
    );
    expect(r.totals.avgWaitMinutes).toBe(20);
  });

  it("averages consult time of finished consultations and ignores impossible ones", () => {
    const r = buildReport(
      [
        token({ startedAt: at("04:00"), completedAt: at("04:06") }), // 6
        token({ startedAt: at("04:00"), completedAt: at("04:10") }), // 10
        token({ startedAt: at("04:00"), completedAt: at("08:00") }), // 240: forgotten Complete
        token({ startedAt: at("04:00"), completedAt: at("04:00") }), // 0
        token({ startedAt: null, completedAt: at("04:00") }), // no start
        token({ status: "NO_SHOW", startedAt: at("04:00"), completedAt: at("04:05") }), // not done
      ],
      [med],
      "2026-11-24",
      "2026-11-24",
    );
    expect(r.totals.avgConsultMinutes).toBe(8);
  });

  it("rounds averages to one decimal and uses null when there is nothing to average", () => {
    const r = buildReport([token({ calledAt: at("04:03") }), token({ calledAt: at("04:04") }), token({ calledAt: at("04:04") })], [med], "2026-11-24", "2026-11-24");
    expect(r.totals.avgWaitMinutes).toBe(3.7);
    const empty = buildReport([], [med], "2026-11-24", "2026-11-24");
    expect(empty.totals).toMatchObject({ total: 0, avgWaitMinutes: null, avgConsultMinutes: null });
  });

  it("has a row for every day, including days with no tokens", () => {
    const r = buildReport([token({ date: "2026-11-22" }), token({ date: "2026-11-24" })], [med], "2026-11-22", "2026-11-25");
    expect(r.days.map((d) => [d.date, d.totals.total])).toEqual([
      ["2026-11-22", 1],
      ["2026-11-23", 0],
      ["2026-11-24", 1],
      ["2026-11-25", 0],
    ]);
  });

  it("splits by department, per day and over the whole range", () => {
    const r = buildReport(
      [
        token({ departmentId: "med" }),
        token({ departmentId: "med", date: "2026-11-25" }),
        token({ departmentId: "ped", date: "2026-11-25" }),
      ],
      [med, ped],
      "2026-11-24",
      "2026-11-25",
    );
    const day2 = r.days[1];
    expect(day2?.departments.map((d) => [d.departmentId, d.total])).toEqual([
      ["med", 1],
      ["ped", 1],
    ]);
    expect(r.byDepartment.map((d) => [d.departmentId, d.total])).toEqual([
      ["med", 2],
      ["ped", 1],
    ]);
    expect(r.totals.total).toBe(3);
  });

  it("ignores tokens outside the range or of unknown departments in the per-department figures", () => {
    const r = buildReport([token({ departmentId: "gone" })], [med], "2026-11-24", "2026-11-24");
    expect(r.byDepartment[0]?.total).toBe(0);
  });

  it("contains no patient information", () => {
    const json = JSON.stringify(buildReport([token()], [med], "2026-11-24", "2026-11-24"));
    expect(json).not.toMatch(/patient|phone|abha|"name"/i);
    expect(json).toMatch(/Medicine/); // the department name is there, so the check can see names at all
  });
});
