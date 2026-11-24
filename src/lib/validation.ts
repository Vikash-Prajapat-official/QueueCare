import { z } from "zod";

/** Indian mobile number. Accepts spaces, dashes, +91, 91 or 0 prefixes; stores 10 digits. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^(?:\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

// bcrypt only uses the first 72 bytes, so longer passwords are refused.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: passwordSchema,
});

export const tokenPrefixSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z]{2,5}$/, "Prefix must be 2 to 5 letters"));

export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colour must look like #0F766E");

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24 hour)");

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
