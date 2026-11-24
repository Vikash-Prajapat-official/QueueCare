import { describe, expect, it } from "vitest";
import { isValidDisplayKey, parseDepartmentIds } from "@/lib/display";

describe("isValidDisplayKey", () => {
  const key = "tv-secret-key-123";

  it("accepts the exact key", () => {
    expect(isValidDisplayKey(key, key)).toBe(true);
  });

  it("refuses a wrong, partial, longer or differently cased key", () => {
    expect(isValidDisplayKey("tv-secret-key-124", key)).toBe(false);
    expect(isValidDisplayKey("tv-secret", key)).toBe(false);
    expect(isValidDisplayKey(key + "x", key)).toBe(false);
    expect(isValidDisplayKey(key.toUpperCase(), key)).toBe(false);
  });

  it("refuses a missing key", () => {
    expect(isValidDisplayKey(null, key)).toBe(false);
    expect(isValidDisplayKey(undefined, key)).toBe(false);
    expect(isValidDisplayKey("", key)).toBe(false);
  });

  it("never opens the board when DISPLAY_KEY is unset, empty or too short", () => {
    expect(isValidDisplayKey("", "")).toBe(false);
    expect(isValidDisplayKey("anything", undefined)).toBe(false);
    expect(isValidDisplayKey("short", "short")).toBe(false);
  });

  it("reads DISPLAY_KEY from the environment by default", () => {
    const before = process.env.DISPLAY_KEY;
    process.env.DISPLAY_KEY = "env-key-123456";
    expect(isValidDisplayKey("env-key-123456")).toBe(true);
    expect(isValidDisplayKey("nope")).toBe(false);
    if (before === undefined) delete process.env.DISPLAY_KEY;
    else process.env.DISPLAY_KEY = before;
  });
});

describe("parseDepartmentIds", () => {
  it("splits a comma separated list and removes duplicates", () => {
    expect(parseDepartmentIds("abcdefgh1,abcdefgh2,abcdefgh1")).toEqual(["abcdefgh1", "abcdefgh2"]);
    expect(parseDepartmentIds("abcdefgh1%2Cabcdefgh2")).toEqual(["abcdefgh1", "abcdefgh2"]);
  });

  it("refuses an empty list, odd characters and ids that are too short", () => {
    expect(parseDepartmentIds("")).toBeNull();
    expect(parseDepartmentIds(",,")).toBeNull();
    expect(parseDepartmentIds("short")).toBeNull();
    expect(parseDepartmentIds("abcdefgh1;drop")).toBeNull();
    expect(parseDepartmentIds("ABCDEFGH1")).toBeNull();
  });

  it("refuses more than 12 departments", () => {
    const many = Array.from({ length: 13 }, (_, i) => `department${i}`).join(",");
    expect(parseDepartmentIds(many)).toBeNull();
  });
});
