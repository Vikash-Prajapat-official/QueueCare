// Patient self check-in from the QR poster. Public, so every limit and check lives here.

import { z } from "zod";
import { ApiError } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { db } from "@/lib/db";
import { createToken, hospitalToday } from "@/lib/queue-service";
import { phoneSchema } from "@/lib/validation";

export const MAX_CHECKINS_PER_PHONE_PER_DAY = 5;
export const MAX_CHECKINS_PER_IP_PER_HOUR = 30;

// Three things to type (name, phone, age), plus two taps (department, sex) that the data model needs.
export const checkInSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter your name").max(100),
  phone: phoneSchema,
  age: z.number().int().min(0).max(120),
  sex: z.enum(["M", "F", "O"]),
  departmentId: z.string().min(1).max(40),
  consent: z.boolean().refine((v) => v === true, "Please tick the box to agree"),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

const ACTIVE = ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED"] as const;

export async function selfCheckIn(input: CheckInInput, req: Request) {
  // 30 per IP per hour. The IP is only known behind a reverse proxy (Caddy sets x-forwarded-for).
  const ip = clientIp(req);
  if (ip) {
    const recent = await db.auditLog.count({
      where: { action: "checkin", ip, at: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= MAX_CHECKINS_PER_IP_PER_HOUR) {
      throw new ApiError(429, "RATE_LIMITED", "Too many check-ins from this network. Please use the registration desk.");
    }
  }

  // 5 per phone per day
  const date = await hospitalToday();
  const today = await db.token.count({ where: { date, source: "SELF", patient: { phone: input.phone } } });
  if (today >= MAX_CHECKINS_PER_PHONE_PER_DAY) {
    throw new ApiError(429, "RATE_LIMITED", "This phone number has checked in too many times today. Please use the registration desk.");
  }

  const department = await db.department.findUnique({
    where: { id: input.departmentId },
    select: { active: true },
  });
  if (!department || !department.active) {
    throw new ApiError(400, "BAD_REFERENCE", "Please choose a department.");
  }

  // Pressing the button twice must not create two tokens: same person, same department, still in the queue.
  const sameName = { equals: input.name, mode: "insensitive" as const };
  const existing = await db.token.findFirst({
    where: {
      date,
      departmentId: input.departmentId,
      status: { in: [...ACTIVE] },
      patient: { phone: input.phone, name: sameName, anonymised: false },
    },
    select: { code: true },
  });
  if (existing) return { code: existing.code, existing: true };

  let patient = await db.patient.findFirst({
    where: { phone: input.phone, name: sameName, anonymised: false },
    select: { id: true },
  });
  if (!patient) {
    patient = await db.patient.create({
      data: { name: input.name, phone: input.phone, age: input.age, sex: input.sex },
      select: { id: true },
    });
  }

  const token = await createToken(
    {
      departmentId: input.departmentId,
      doctorId: null,
      visitType: "NEW",
      // Older patients are placed in the elderly queue automatically. Pregnant and disabled
      // patients, and emergencies, are registered at the desk.
      priority: input.age >= 60 ? "ELDERLY" : "NORMAL",
      consent: true,
      patientId: patient.id,
    },
    null,
    req,
    "SELF",
  );
  await audit(null, "checkin", "Token", token.id, req);
  return { code: token.code, existing: false };
}
