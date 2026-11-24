import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError, type AuthedUser } from "@/lib/api";
import { db } from "@/lib/db";
import {
  colorSchema,
  passwordSchema,
  phoneSchema,
  timeSchema,
  timeToMinutes,
  tokenPrefixSchema,
} from "@/lib/validation";

/** One admin-managed table. The generic handlers in handlers.ts turn this into API routes. */
export interface AdminEntity {
  /** Used in AuditLog.entity */
  name: string;
  list(): Promise<unknown[]>;
  create(body: unknown, actor: AuthedUser): Promise<{ id: string }>;
  update(id: string, body: unknown, actor: AuthedUser): Promise<{ id: string }>;
  remove?(id: string): Promise<void>;
}

const name = z.string().trim().min(1, "Required").max(80);
const id = z.string().min(1).max(40);

// ---------------------------------------------------------------- departments

const departmentCreate = z.strictObject({
  nameEn: name,
  nameHi: name,
  tokenPrefix: tokenPrefixSchema,
  color: colorSchema.default("#0F766E"),
});
// tokenPrefix is fixed once created: old tokens are shown with the department's prefix.
const departmentUpdate = z.strictObject({
  nameEn: name.optional(),
  nameHi: name.optional(),
  color: colorSchema.optional(),
  active: z.boolean().optional(),
});

export const departments: AdminEntity = {
  name: "Department",
  list: () => db.department.findMany({ orderBy: { nameEn: "asc" } }),
  create: (body) => db.department.create({ data: departmentCreate.parse(body) }),
  update: (rid, body) => db.department.update({ where: { id: rid }, data: departmentUpdate.parse(body) }),
};

// ---------------------------------------------------------------------- rooms

const roomCreate = z.strictObject({ name, departmentId: id });
// A room cannot move to another department: doctors may already be assigned to it.
const roomUpdate = z.strictObject({ name: name.optional() });

export const rooms: AdminEntity = {
  name: "Room",
  list: () => db.room.findMany({ orderBy: [{ departmentId: "asc" }, { name: "asc" }] }),
  create: (body) => db.room.create({ data: roomCreate.parse(body) }),
  update: (rid, body) => db.room.update({ where: { id: rid }, data: roomUpdate.parse(body) }),
};

// ---------------------------------------------------------------------- users

const userCreate = z.strictObject({
  name,
  phone: phoneSchema,
  password: passwordSchema,
  role: z.enum(["ADMIN", "CLERK", "DOCTOR"]),
  departmentId: id.nullable().optional(),
});
const userUpdate = z.strictObject({
  name: name.optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(["ADMIN", "CLERK", "DOCTOR"]).optional(),
  departmentId: id.nullable().optional(),
  active: z.boolean().optional(),
});

const userSelect = {
  id: true,
  name: true,
  phone: true,
  role: true,
  departmentId: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const; // passwordHash is never selected

export const users: AdminEntity = {
  name: "User",
  list: () => db.user.findMany({ select: userSelect, orderBy: [{ role: "asc" }, { name: "asc" }] }),
  async create(body) {
    const { password, ...data } = userCreate.parse(body);
    return db.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true },
      select: userSelect,
    });
  },
  async update(rid, body, actor) {
    const { password, ...data } = userUpdate.parse(body);
    if (rid === actor.id && (data.role !== undefined || data.active === false)) {
      throw new ApiError(400, "SELF_LOCKOUT", "You cannot change your own role or deactivate yourself.");
    }
    if (data.role !== undefined) {
      const existing = await db.user.findUnique({ where: { id: rid }, select: { doctor: { select: { id: true } } } });
      if (existing?.doctor && data.role !== "DOCTOR") {
        throw new ApiError(409, "HAS_DOCTOR_PROFILE", "This user has a doctor profile. Remove it before changing the role.");
      }
    }
    return db.user.update({
      where: { id: rid },
      data: {
        ...data,
        // An admin-set password is temporary: the person must choose their own at next login.
        ...(password ? { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } : {}),
      },
      select: userSelect,
    });
  },
};

// -------------------------------------------------------------------- doctors

const doctorCreate = z.strictObject({
  userId: id,
  departmentId: id,
  roomId: id.nullable().optional(),
  displayName: name,
});
// The department of a doctor is fixed once created (their tokens belong to it).
const doctorUpdate = z.strictObject({
  roomId: id.nullable().optional(),
  displayName: name.optional(),
});

async function assertRoomInDepartment(roomId: string | null | undefined, departmentId: string) {
  if (!roomId) return;
  const room = await db.room.findUnique({ where: { id: roomId }, select: { departmentId: true } });
  if (!room) throw new ApiError(400, "BAD_REFERENCE", "Room does not exist.");
  if (room.departmentId !== departmentId) {
    throw new ApiError(400, "ROOM_DEPARTMENT_MISMATCH", "The room belongs to a different department.");
  }
}

export const doctors: AdminEntity = {
  name: "Doctor",
  list: () =>
    db.doctor.findMany({
      include: { user: { select: { name: true, phone: true, active: true } } },
      orderBy: { displayName: "asc" },
    }),
  async create(body) {
    const data = doctorCreate.parse(body);
    const user = await db.user.findUnique({ where: { id: data.userId }, select: { role: true } });
    if (!user) throw new ApiError(400, "BAD_REFERENCE", "User does not exist.");
    if (user.role !== "DOCTOR") throw new ApiError(400, "NOT_A_DOCTOR", "The user must have the DOCTOR role.");
    await assertRoomInDepartment(data.roomId, data.departmentId);
    return db.$transaction(async (tx) => {
      const doctor = await tx.doctor.create({ data });
      await tx.user.update({ where: { id: data.userId }, data: { departmentId: data.departmentId } });
      return doctor;
    });
  },
  async update(rid, body) {
    const data = doctorUpdate.parse(body);
    const existing = await db.doctor.findUnique({ where: { id: rid }, select: { departmentId: true } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Doctor not found.");
    await assertRoomInDepartment(data.roomId, existing.departmentId);
    return db.doctor.update({ where: { id: rid }, data });
  },
};

// ------------------------------------------------------------------- sessions

const sessionFields = {
  weekday: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  maxTokens: z.number().int().min(1).max(5000).nullable(),
};
const sessionCreate = z.strictObject({
  departmentId: id,
  doctorId: id.nullable().optional(),
  weekday: sessionFields.weekday,
  startTime: sessionFields.startTime,
  endTime: sessionFields.endTime,
  maxTokens: sessionFields.maxTokens.optional(),
});
const sessionUpdate = z.strictObject({
  doctorId: id.nullable().optional(),
  weekday: sessionFields.weekday.optional(),
  startTime: sessionFields.startTime.optional(),
  endTime: sessionFields.endTime.optional(),
  maxTokens: sessionFields.maxTokens.optional(),
});

function assertTimes(start: string, end: string) {
  if (timeToMinutes(start) >= timeToMinutes(end)) {
    throw new ApiError(400, "VALIDATION", "End time must be after start time.");
  }
}

async function assertDoctorInDepartment(doctorId: string | null | undefined, departmentId: string) {
  if (!doctorId) return;
  const doctor = await db.doctor.findUnique({ where: { id: doctorId }, select: { departmentId: true } });
  if (!doctor) throw new ApiError(400, "BAD_REFERENCE", "Doctor does not exist.");
  if (doctor.departmentId !== departmentId) {
    throw new ApiError(400, "DOCTOR_DEPARTMENT_MISMATCH", "The doctor belongs to a different department.");
  }
}

export const sessions: AdminEntity = {
  name: "OpdSession",
  list: () =>
    db.opdSession.findMany({ orderBy: [{ departmentId: "asc" }, { weekday: "asc" }, { startTime: "asc" }] }),
  async create(body) {
    const data = sessionCreate.parse(body);
    assertTimes(data.startTime, data.endTime);
    await assertDoctorInDepartment(data.doctorId, data.departmentId);
    return db.opdSession.create({ data });
  },
  async update(rid, body) {
    const data = sessionUpdate.parse(body);
    const existing = await db.opdSession.findUnique({ where: { id: rid } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Session not found.");
    assertTimes(data.startTime ?? existing.startTime, data.endTime ?? existing.endTime);
    await assertDoctorInDepartment(data.doctorId, existing.departmentId);
    return db.opdSession.update({ where: { id: rid }, data });
  },
  async remove(rid) {
    await db.opdSession.delete({ where: { id: rid } });
  },
};
