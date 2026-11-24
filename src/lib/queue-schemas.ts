import { z } from "zod";
import { PRIORITIES } from "@/lib/queue";
import { phoneSchema } from "@/lib/validation";

const id = z.string().min(1).max(40);

// ABHA numbers are 14 digits, often written 12-3456-7890-1234.
export const abhaSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{14}$/, "ABHA number must be 14 digits"));

export const patientInputSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter the patient's name").max(100),
  phone: phoneSchema,
  age: z.number().int().min(0).max(120),
  sex: z.enum(["M", "F", "O"]),
  abhaNumber: abhaSchema.nullable().optional(),
});

/** POST /api/tokens: either an existing patient (found by phone search) or the details of a new one. */
export const createTokenSchema = z
  .strictObject({
    departmentId: id,
    doctorId: id.nullable().optional(),
    visitType: z.enum(["NEW", "FOLLOW_UP"]).default("NEW"),
    priority: z.enum(PRIORITIES).default("NORMAL"),
    consent: z.boolean().refine((v) => v === true, "The patient's consent is required"),
    patientId: id.optional(),
    patient: patientInputSchema.optional(),
  })
  .refine((v) => (v.patientId ? 1 : 0) + (v.patient ? 1 : 0) === 1, {
    message: "Give either patientId or patient details, not both",
    path: ["patient"],
  });

export const transferSchema = z.strictObject({ doctorId: id.nullable() });

export const searchPhoneSchema = phoneSchema;
