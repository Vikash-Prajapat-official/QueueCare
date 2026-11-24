import { beforeEach, describe, expect, it } from "vitest";
import { clearAllLimits, consume, resetLimit } from "@/lib/rate-limit";

beforeEach(() => clearAllLimits());

describe("consume", () => {
  it("allows up to the limit and refuses the next one", () => {
    for (let i = 1; i <= 3; i++) expect(consume("k", 3, 60_000, 1000).ok).toBe(true);
    const fourth = consume("k", 3, 60_000, 1000);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("reports what is left", () => {
    expect(consume("k", 5, 60_000, 0).remaining).toBe(4);
    expect(consume("k", 5, 60_000, 0).remaining).toBe(3);
  });

  it("keeps each key separate", () => {
    consume("a", 1, 60_000, 0);
    expect(consume("a", 1, 60_000, 0).ok).toBe(false);
    expect(consume("b", 1, 60_000, 0).ok).toBe(true);
  });

  it("starts a fresh window once the time is up", () => {
    consume("k", 1, 10_000, 0);
    expect(consume("k", 1, 10_000, 9_999).ok).toBe(false);
    expect(consume("k", 1, 10_000, 10_000).ok).toBe(true);
  });

  it("says how long to wait, rounded up to whole seconds and never less than 1", () => {
    consume("k", 1, 60_000, 0);
    expect(consume("k", 1, 60_000, 0).retryAfterSeconds).toBe(60);
    expect(consume("k", 1, 60_000, 30_500).retryAfterSeconds).toBe(30);
    expect(consume("k", 1, 60_000, 59_999).retryAfterSeconds).toBe(1);
  });

  it("can be reset, for example after a successful login", () => {
    consume("k", 1, 60_000, 0);
    expect(consume("k", 1, 60_000, 0).ok).toBe(false);
    resetLimit("k");
    expect(consume("k", 1, 60_000, 0).ok).toBe(true);
  });

  it("does not grow without end", () => {
    for (let i = 0; i < 12_000; i++) consume(`k${i}`, 1, 1000, 0);
    consume("late", 1, 1000, 5000); // sweeps the expired buckets
    expect(consume("k5", 1, 1000, 5000).ok).toBe(true); // old bucket is gone, so a new window starts
  });
});
