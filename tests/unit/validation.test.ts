import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  colorSchema,
  loginSchema,
  passwordSchema,
  phoneSchema,
  timeSchema,
  timeToMinutes,
  tokenPrefixSchema,
} from "@/lib/validation";

describe("phoneSchema", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["91-9876543210", "9876543210"],
    ["09876543210", "9876543210"],
    [" 9000000001 ", "9000000001"],
  ])("normalises %s", (input, expected) => {
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it.each(["", "12345", "5876543210", "98765432101", "abcdefghij"])("rejects %j", (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("needs 8 to 72 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("long-enough").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(73)).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalises the phone number", () => {
    expect(loginSchema.parse({ phone: "+919000000001", password: "x" }).phone).toBe("9000000001");
  });
  it("needs a password", () => {
    expect(loginSchema.safeParse({ phone: "9000000001", password: "" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("refuses unknown fields and weak new passwords", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "a", newPassword: "short" }).success).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "a", newPassword: "long-enough", role: "ADMIN" }).success,
    ).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "a", newPassword: "long-enough" }).success).toBe(true);
  });
});

describe("tokenPrefixSchema", () => {
  it("uppercases and accepts 2 to 5 letters", () => {
    expect(tokenPrefixSchema.parse("med")).toBe("MED");
    expect(tokenPrefixSchema.parse(" ortho ")).toBe("ORTHO");
  });
  it.each(["M", "MEDICINE", "M3D", "ME-D", ""])("rejects %j", (input) => {
    expect(tokenPrefixSchema.safeParse(input).success).toBe(false);
  });
});

describe("colorSchema and timeSchema", () => {
  it("accepts hex colours only", () => {
    expect(colorSchema.safeParse("#0F766E").success).toBe(true);
    expect(colorSchema.safeParse("teal").success).toBe(false);
    expect(colorSchema.safeParse("#0F76").success).toBe(false);
  });

  it("accepts 24 hour HH:MM only", () => {
    expect(timeSchema.safeParse("09:00").success).toBe(true);
    expect(timeSchema.safeParse("23:59").success).toBe(true);
    expect(timeSchema.safeParse("24:00").success).toBe(false);
    expect(timeSchema.safeParse("9:00").success).toBe(false);
    expect(timeSchema.safeParse("09:60").success).toBe(false);
  });

  it("converts time to minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("13:00")).toBeGreaterThan(timeToMinutes("09:00"));
  });
});
