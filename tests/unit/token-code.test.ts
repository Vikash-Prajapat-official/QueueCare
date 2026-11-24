import { describe, expect, it } from "vitest";
import { generateTokenCode } from "@/lib/token-code";

describe("generateTokenCode", () => {
  it("returns 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTokenCode()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    }
  });

  it("does not repeat across a large sample", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => generateTokenCode()));
    expect(codes.size).toBe(5000);
  });
});
