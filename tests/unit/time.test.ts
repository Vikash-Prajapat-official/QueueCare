import { describe, expect, it } from "vitest";
import { addDays, daysInRange, eachDay, formatLocal, isValidYmd, startOfLocalDay, tzOffsetMinutes } from "@/lib/time";

describe("calendar dates", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isValidYmd("2026-11-24")).toBe(true);
    expect(isValidYmd("2028-02-29")).toBe(true);
    expect(isValidYmd("2026-02-29")).toBe(false);
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(isValidYmd("24-11-2026")).toBe(false);
    expect(isValidYmd("2026-11-24T00:00")).toBe(false);
    expect(isValidYmd("")).toBe(false);
  });

  it("adds and subtracts days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-11-24", -6)).toBe("2026-11-18");
  });

  it("counts days with both ends included and lists them", () => {
    expect(daysInRange("2026-11-24", "2026-11-24")).toBe(1);
    expect(daysInRange("2026-11-18", "2026-11-24")).toBe(7);
    expect(eachDay("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});

describe("time zones", () => {
  it("knows India is 5 hours 30 minutes ahead of UTC", () => {
    expect(tzOffsetMinutes(new Date("2026-11-24T10:00:00Z"), "Asia/Kolkata")).toBe(330);
  });

  it("follows daylight saving", () => {
    expect(tzOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(tzOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(-240);
  });

  it("finds where a local day starts", () => {
    expect(startOfLocalDay("2026-11-24", "Asia/Kolkata").toISOString()).toBe("2026-11-23T18:30:00.000Z");
    expect(startOfLocalDay("2026-11-24", "UTC").toISOString()).toBe("2026-11-24T00:00:00.000Z");
    expect(startOfLocalDay("2026-07-15", "America/New_York").toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });

  it("finds the day start on the day the clocks change", () => {
    // 8 March 2026: New York moves to daylight time at 02:00, midnight is still winter time
    expect(startOfLocalDay("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(startOfLocalDay("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("writes local time as YYYY-MM-DD HH:mm:ss", () => {
    expect(formatLocal(new Date("2026-11-24T18:35:09Z"), "Asia/Kolkata")).toBe("2026-11-25 00:05:09");
    expect(formatLocal(new Date("2026-11-24T00:00:00Z"), "UTC")).toBe("2026-11-24 00:00:00");
    expect(formatLocal(null, "UTC")).toBe("");
  });
});
