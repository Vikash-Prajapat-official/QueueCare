// Database side of the queue. Each change runs in ONE transaction that locks the department row,
// updates the token, writes a QueueEvent and an AuditLog row, and sends NOTIFY queue_<departmentId>.
// The rules themselves (order, skip, moves, estimates) are in queue.ts.

import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { ApiError, type AuthedUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  ACTION_FROM,
  CONSULT_WINDOW,
  averageConsultMinutes,
  consultMinutes,
  eligibleQueue,
  estimateWaitMinutes,
  formatTokenNumber,
  holdForSkip,
  localDate,
  nextSeqNo,
  peopleAhead,
  predictCallOrder,
  releaseAfterCall,
  sortWaiting,
  type QueueToken,
  type TokenAction,
  type TokenStatus,
} from "@/lib/queue";
import { generateTokenCode } from "@/lib/token-code";
import { transferSchema, type createTokenSchema } from "@/lib/queue-schemas";

type Tx = Prisma.TransactionClient;

export const CONSENT_NOTICE_VERSION = "v1";
const DEFAULT_TIMEZONE = "Asia/Kolkata";

// Fields the engine needs for every token of a department.
const queueFields = {
  id: true,
  seqNo: true,
  priority: true,
  status: true,
  skipHold: true,
  doctorId: true,
} as const;

// ------------------------------------------------------------------ helpers

/** Today's date in the hospital's own time zone (this is what resets token numbers at midnight). */
export async function hospitalToday(client: Tx = db): Promise<Date> {
  const hospital = await client.hospital.findFirst({ select: { timezone: true } });
  return localDate(new Date(), hospital?.timezone ?? DEFAULT_TIMEZONE);
}

/** Serialises every queue change of one department (two doctors never get the same patient). */
async function lockDepartment(tx: Tx, departmentId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM departments WHERE id = ${departmentId} FOR UPDATE`;
  if (rows.length === 0) throw new ApiError(404, "NOT_FOUND", "Department not found.");
}

/** Delivered to listeners when the transaction commits. Never contains names or phone numbers. */
async function notify(tx: Tx, departmentId: string, payload: Record<string, unknown>) {
  await tx.$queryRaw`SELECT pg_notify(${"queue_" + departmentId}, ${JSON.stringify(payload)})::text`;
}

async function record(
  tx: Tx,
  tokenId: string,
  action: string,
  actor: AuthedUser | null,
  meta: Record<string, unknown>,
  req?: Request,
) {
  await tx.queueEvent.create({
    data: { tokenId, action, actorUserId: actor?.id ?? null, meta: meta as Prisma.InputJsonValue },
  });
  await audit(actor?.id ?? null, `queue.${action}`, "Token", tokenId, req, tx);
}

async function requireDoctorProfile(user: AuthedUser, departmentId: string) {
  const doctor = await db.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, departmentId: true, displayName: true },
  });
  if (!doctor) {
    throw new ApiError(403, "NO_DOCTOR_PROFILE", "Your doctor profile is not set up. Ask the admin.");
  }
  if (doctor.departmentId !== departmentId) {
    throw new ApiError(403, "FORBIDDEN", "This is not your department.");
  }
  return doctor;
}

async function loadQueueTokens(client: Tx, departmentId: string, date: Date): Promise<QueueToken[]> {
  return client.token.findMany({ where: { departmentId, date }, select: queueFields });
}

async function recentConsultMinutes(departmentId: string, doctorId: string | null): Promise<number[]> {
  const rows = await db.token.findMany({
    where: {
      departmentId,
      status: "DONE",
      startedAt: { not: null },
      completedAt: { not: null },
      ...(doctorId ? { doctorId } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: CONSULT_WINDOW,
    select: { startedAt: true, completedAt: true },
  });
  return rows.map((r) => consultMinutes(r.startedAt, r.completedAt)).filter((m): m is number => m !== null);
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// --------------------------------------------------------------- create token

export type CreateTokenInput = z.infer<typeof createTokenSchema>;

/** `actor` is null and `source` is "SELF" when a patient checks in on their own phone. */
export async function createToken(
  input: CreateTokenInput,
  actor: AuthedUser | null,
  req: Request,
  source: "DESK" | "SELF" = "DESK",
) {
  const department = await db.department.findUnique({
    where: { id: input.departmentId },
    select: { id: true, tokenPrefix: true, nameEn: true, nameHi: true, active: true },
  });
  if (!department || !department.active) {
    throw new ApiError(400, "BAD_REFERENCE", "Department does not exist or is not active.");
  }

  let doctor: { id: string; displayName: string; room: { name: string } | null } | null = null;
  if (input.doctorId) {
    const d = await db.doctor.findUnique({
      where: { id: input.doctorId },
      select: {
        id: true,
        displayName: true,
        departmentId: true,
        room: { select: { name: true } },
        user: { select: { active: true } },
      },
    });
    if (!d || !d.user.active) throw new ApiError(400, "BAD_REFERENCE", "Doctor does not exist or is not active.");
    if (d.departmentId !== department.id) {
      throw new ApiError(400, "DOCTOR_DEPARTMENT_MISMATCH", "The doctor belongs to a different department.");
    }
    doctor = d;
  }

  const date = await hospitalToday();

  const token = await db.$transaction(async (tx) => {
    await lockDepartment(tx, department.id);

    let patientId = input.patientId;
    if (patientId) {
      const existing = await tx.patient.findUnique({ where: { id: patientId }, select: { anonymised: true } });
      if (!existing || existing.anonymised) throw new ApiError(400, "BAD_REFERENCE", "Patient not found.");
    } else if (input.patient) {
      const created = await tx.patient.create({
        data: { ...input.patient, abhaNumber: input.patient.abhaNumber ?? null },
        select: { id: true },
      });
      patientId = created.id;
    }
    if (!patientId) throw new ApiError(400, "VALIDATION", "Patient details are required.");

    await tx.consentRecord.create({
      data: { patientId, purpose: "OPD queue", noticeVersion: CONSENT_NOTICE_VERSION, channel: source },
    });

    // Numbering restarts at 1 each local day because the highest number is taken per (department, date).
    const highest = await tx.token.aggregate({ where: { departmentId: department.id, date }, _max: { seqNo: true } });
    const seqNo = nextSeqNo(highest._max.seqNo);

    let code = generateTokenCode();
    for (let i = 0; i < 5 && (await tx.token.findUnique({ where: { code }, select: { id: true } })); i++) {
      code = generateTokenCode();
    }

    const created = await tx.token.create({
      data: {
        code,
        seqNo,
        date,
        departmentId: department.id,
        doctorId: doctor?.id ?? null,
        patientId,
        visitType: input.visitType,
        priority: input.priority,
        source,
      },
    });
    await record(tx, created.id, "create", actor, { priority: input.priority, source }, req);
    await notify(tx, department.id, { type: "token", action: "create", tokenId: created.id });
    return created;
  });

  const queue = await loadQueueTokens(db, department.id, date);
  const self = queue.find((t) => t.id === token.id);
  const ahead = self ? peopleAhead(queue, self) : 0;
  const average = averageConsultMinutes(await recentConsultMinutes(department.id, token.doctorId));

  return {
    id: token.id,
    code: token.code,
    label: formatTokenNumber(department.tokenPrefix, token.seqNo),
    seqNo: token.seqNo,
    priority: token.priority,
    status: token.status,
    date: isoDay(date),
    department: { nameEn: department.nameEn, nameHi: department.nameHi, tokenPrefix: department.tokenPrefix },
    doctorName: doctor?.displayName ?? null,
    roomName: doctor?.room?.name ?? null,
    peopleAhead: ahead,
    estimatedWaitMinutes: estimateWaitMinutes(average, ahead),
  };
}

// ------------------------------------------------------------------ call next

export async function callNext(departmentId: string, user: AuthedUser, req: Request) {
  const doctor = await requireDoctorProfile(user, departmentId);
  const date = await hospitalToday();

  return db.$transaction(async (tx) => {
    await lockDepartment(tx, departmentId);

    const tokens = await tx.token.findMany({
      where: {
        departmentId,
        date,
        status: { in: ["WAITING", "SKIPPED", "CALLED", "IN_CONSULT"] },
        OR: [{ doctorId: null }, { doctorId: doctor.id }],
      },
      select: queueFields,
    });
    const mine = tokens.filter((t) => t.doctorId === doctor.id);

    if (mine.some((t) => t.status === "CALLED")) {
      throw new ApiError(
        409,
        "CURRENT_PATIENT_ACTIVE",
        "The current patient has been called. Start the consult, skip, or mark no-show first.",
      );
    }
    const inConsult = mine.find((t) => t.status === "IN_CONSULT");
    const others = tokens.filter((t) => t.id !== inConsult?.id);

    // Decide first, write after: if nobody is waiting nothing is changed.
    let waiting = eligibleQueue(others, doctor.id);
    let held = others.filter((t) => t.status === "SKIPPED" && t.doctorId === doctor.id);
    const releasedNow: QueueToken[] = [];
    if (waiting.length === 0 && held.length > 0) {
      // Nobody else to wait for, so skipped patients come back now.
      releasedNow.push(...held);
      waiting = sortWaiting(held.map((t) => ({ ...t, status: "WAITING" as const })));
      held = [];
    }
    const next = waiting[0];
    if (!next) throw new ApiError(409, "QUEUE_EMPTY", "Nobody is waiting.");

    const now = new Date();
    if (inConsult) {
      await tx.token.update({ where: { id: inConsult.id }, data: { status: "DONE", completedAt: now } });
      await record(tx, inConsult.id, "complete", user, { auto: true }, req);
    }
    for (const t of releasedNow) {
      await tx.token.update({ where: { id: t.id }, data: { status: "WAITING", skipHold: 0 } });
      await record(tx, t.id, "requeue", null, { reason: "queue-empty" }, req);
    }

    await tx.token.update({
      where: { id: next.id },
      data: { status: "CALLED", calledAt: now, doctorId: doctor.id, skipHold: 0 },
    });
    await record(tx, next.id, "call", user, { doctorId: doctor.id }, req);

    // One more call has been made: skipped patients move closer to returning.
    for (const h of releaseAfterCall(held)) {
      await tx.token.update({
        where: { id: h.id },
        data: h.release ? { status: "WAITING", skipHold: 0 } : { skipHold: h.skipHold },
      });
      if (h.release) await record(tx, h.id, "requeue", null, { reason: "hold-over" }, req);
    }

    const department = await tx.department.findUniqueOrThrow({
      where: { id: departmentId },
      select: { tokenPrefix: true },
    });
    const label = formatTokenNumber(department.tokenPrefix, next.seqNo);
    await notify(tx, departmentId, { type: "token", action: "call", tokenId: next.id, label });
    return { id: next.id, label, status: "CALLED" as TokenStatus };
  });
}

// ------------------------------------------------------------- token actions

const VERBS: Record<TokenAction, string> = {
  skip: "skipped",
  recall: "recalled",
  "no-show": "marked as no-show",
  start: "started",
  complete: "completed",
  transfer: "transferred",
  cancel: "cancelled",
};
const ONLY_THE_TOKENS_DOCTOR: readonly TokenAction[] = ["skip", "recall", "no-show", "start", "complete"];

export async function applyTokenAction(
  tokenId: string,
  action: TokenAction,
  user: AuthedUser,
  body: unknown,
  req: Request,
) {
  const found = await db.token.findUnique({ where: { id: tokenId }, select: { departmentId: true } });
  if (!found) throw new ApiError(404, "NOT_FOUND", "Token not found.");
  // A doctor may only act inside their own department.
  const doctor = user.role === "DOCTOR" ? await requireDoctorProfile(user, found.departmentId) : null;
  const transferTo = action === "transfer" ? transferSchema.parse(body).doctorId : null;

  return db.$transaction(async (tx) => {
    await lockDepartment(tx, found.departmentId);

    const token = await tx.token.findUnique({
      where: { id: tokenId },
      select: { ...queueFields, departmentId: true, date: true, skipCount: true, recallCount: true },
    });
    if (!token) throw new ApiError(404, "NOT_FOUND", "Token not found.");

    if (doctor && ONLY_THE_TOKENS_DOCTOR.includes(action) && token.doctorId !== doctor.id) {
      throw new ApiError(403, "NOT_YOUR_PATIENT", "This patient was called by another doctor.");
    }
    if (!ACTION_FROM[action].includes(token.status)) {
      throw new ApiError(
        409,
        "INVALID_MOVE",
        `A token that is ${token.status.toLowerCase().replace("_", " ")} cannot be ${VERBS[action]}.`,
      );
    }

    const now = new Date();
    let to: TokenStatus = token.status;
    const meta: Record<string, unknown> = {};

    switch (action) {
      case "recall":
        await tx.token.update({ where: { id: tokenId }, data: { recallCount: { increment: 1 } } });
        break;

      case "start":
        to = "IN_CONSULT";
        await tx.token.update({ where: { id: tokenId }, data: { status: to, startedAt: now } });
        break;

      case "complete":
        to = "DONE";
        await tx.token.update({ where: { id: tokenId }, data: { status: to, completedAt: now } });
        break;

      case "no-show":
        to = "NO_SHOW";
        await tx.token.update({ where: { id: tokenId }, data: { status: to } });
        break;

      case "cancel":
        to = "CANCELLED";
        await tx.token.update({ where: { id: tokenId }, data: { status: to } });
        break;

      case "skip": {
        // The patient comes back after the next 3 waiting patients (or after all, if fewer wait).
        const queue = await loadQueueTokens(tx, token.departmentId, token.date);
        const hold = holdForSkip(eligibleQueue(queue, token.doctorId).length);
        meta.hold = hold;
        to = hold > 0 ? "SKIPPED" : "WAITING";
        await tx.token.update({
          where: { id: tokenId },
          data: { status: to, skipHold: hold, skipCount: { increment: 1 } },
        });
        break;
      }

      case "transfer": {
        if (transferTo) {
          const target = await tx.doctor.findUnique({
            where: { id: transferTo },
            select: { departmentId: true, user: { select: { active: true } } },
          });
          if (!target || !target.user.active) throw new ApiError(400, "BAD_REFERENCE", "Doctor does not exist or is not active.");
          if (target.departmentId !== token.departmentId) {
            throw new ApiError(400, "DOCTOR_DEPARTMENT_MISMATCH", "The doctor belongs to a different department.");
          }
        }
        meta.from = token.doctorId;
        meta.to = transferTo;
        await tx.token.update({ where: { id: tokenId }, data: { doctorId: transferTo } });
        break;
      }
    }

    await record(tx, tokenId, action, user, { from: token.status, to, ...meta }, req);
    if (action === "skip" && to === "WAITING") {
      await record(tx, tokenId, "requeue", null, { reason: "nobody-else-waiting" }, req);
    }
    await notify(tx, token.departmentId, { type: "token", action, tokenId });
    return { id: tokenId, status: to };
  });
}

// ----------------------------------------------------------------- read models

export interface TokenView {
  id: string;
  code: string;
  label: string;
  seqNo: number;
  status: TokenStatus;
  priority: string;
  visitType: string;
  source: string;
  skipHold: number;
  skipCount: number;
  recallCount: number;
  doctorId: string | null;
  doctorName: string | null;
  patient: { name: string; age: number; sex: string };
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const viewSelect = {
  ...queueFields,
  code: true,
  visitType: true,
  source: true,
  skipCount: true,
  recallCount: true,
  createdAt: true,
  calledAt: true,
  startedAt: true,
  completedAt: true,
  patient: { select: { name: true, age: true, sex: true } },
  doctor: { select: { displayName: true } },
} satisfies Prisma.TokenSelect;

type ViewRow = Prisma.TokenGetPayload<{ select: typeof viewSelect }>;

/**
 * Today's queue of a department for staff screens. Names are included for staff only;
 * phone numbers never are. `scopeDoctorId` limits the view to one doctor's own queue.
 */
export async function getQueueSnapshot(departmentId: string, scopeDoctorId: string | null) {
  const date = await hospitalToday();
  const department = await db.department.findUnique({
    where: { id: departmentId },
    select: { id: true, nameEn: true, nameHi: true, tokenPrefix: true, color: true },
  });
  if (!department) throw new ApiError(404, "NOT_FOUND", "Department not found.");

  const [rows, doctors, minutes] = await Promise.all([
    db.token.findMany({
      where: {
        departmentId,
        date,
        ...(scopeDoctorId ? { OR: [{ doctorId: null }, { doctorId: scopeDoctorId }] } : {}),
      },
      select: viewSelect,
      orderBy: { seqNo: "asc" },
    }),
    db.doctor.findMany({
      where: { departmentId, user: { active: true } },
      select: { id: true, displayName: true, room: { select: { name: true } } },
      orderBy: { displayName: "asc" },
    }),
    recentConsultMinutes(departmentId, scopeDoctorId),
  ]);

  const average = averageConsultMinutes(minutes);
  const toView = (t: ViewRow): TokenView => ({
    id: t.id,
    code: t.code,
    label: formatTokenNumber(department.tokenPrefix, t.seqNo),
    seqNo: t.seqNo,
    status: t.status,
    priority: t.priority,
    visitType: t.visitType,
    source: t.source,
    skipHold: t.skipHold,
    skipCount: t.skipCount,
    recallCount: t.recallCount,
    doctorId: t.doctorId,
    doctorName: t.doctor?.displayName ?? null,
    patient: { name: t.patient.name, age: t.patient.age, sex: t.patient.sex },
    createdAt: t.createdAt.toISOString(),
    calledAt: t.calledAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
  });

  const count = (status: TokenStatus) => rows.filter((t) => t.status === status).length;
  const waiting = predictCallOrder(rows, scopeDoctorId).map((t, index) => ({
    ...toView(t),
    position: index + 1,
    peopleAhead: index,
    estimatedWaitMinutes: estimateWaitMinutes(average, index),
  }));
  const finished = rows
    .filter((t) => t.status === "DONE" || t.status === "NO_SHOW" || t.status === "CANCELLED")
    .sort((a, b) => (b.completedAt ?? b.createdAt).getTime() - (a.completedAt ?? a.createdAt).getTime())
    .slice(0, 15)
    .map(toView);

  return {
    department,
    date: isoDay(date),
    averageConsultMinutes: Math.round(average * 10) / 10,
    counts: {
      waiting: count("WAITING"),
      skipped: count("SKIPPED"),
      called: count("CALLED"),
      inConsult: count("IN_CONSULT"),
      done: count("DONE"),
      noShow: count("NO_SHOW"),
      cancelled: count("CANCELLED"),
      total: rows.length,
    },
    current: rows.filter((t) => t.status === "CALLED" || t.status === "IN_CONSULT").map(toView),
    waiting,
    finished,
    doctors: doctors.map((d) => ({ id: d.id, displayName: d.displayName, roomName: d.room?.name ?? null })),
  };
}

/** Departments with today's counts, for any logged-in user. */
export async function listDepartments() {
  const date = await hospitalToday();
  const [departments, groups] = await Promise.all([
    db.department.findMany({
      where: { active: true },
      orderBy: { nameEn: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameHi: true,
        tokenPrefix: true,
        color: true,
        doctors: {
          where: { user: { active: true } },
          select: { id: true, displayName: true, room: { select: { name: true } } },
          orderBy: { displayName: "asc" },
        },
      },
    }),
    db.token.groupBy({ by: ["departmentId", "status"], where: { date }, _count: { _all: true } }),
  ]);

  return departments.map((d) => {
    const mine = groups.filter((g) => g.departmentId === d.id);
    const n = (...statuses: TokenStatus[]) =>
      mine.filter((g) => statuses.includes(g.status)).reduce((sum, g) => sum + g._count._all, 0);
    return {
      id: d.id,
      nameEn: d.nameEn,
      nameHi: d.nameHi,
      tokenPrefix: d.tokenPrefix,
      color: d.color,
      doctors: d.doctors.map((doc) => ({ id: doc.id, displayName: doc.displayName, roomName: doc.room?.name ?? null })),
      today: {
        waiting: n("WAITING", "SKIPPED"),
        inProgress: n("CALLED", "IN_CONSULT"),
        done: n("DONE"),
        noShow: n("NO_SHOW"),
        cancelled: n("CANCELLED"),
        total: n("WAITING", "SKIPPED", "CALLED", "IN_CONSULT", "DONE", "NO_SHOW", "CANCELLED"),
      },
    };
  });
}

/** Public status of one token by its 8-character code. Contains no personal data. */
export async function getTokenStatusByCode(code: string) {
  if (!/^[0-9A-Z]{8}$/.test(code)) throw new ApiError(404, "NOT_FOUND", "Token not found.");
  const token = await db.token.findUnique({
    where: { code },
    select: {
      id: true,
      seqNo: true,
      status: true,
      date: true,
      departmentId: true,
      doctorId: true,
      department: { select: { nameEn: true, nameHi: true, tokenPrefix: true } },
      doctor: { select: { displayName: true, room: { select: { name: true } } } },
    },
  });
  if (!token) throw new ApiError(404, "NOT_FOUND", "Token not found.");

  const isToday = token.date.getTime() === (await hospitalToday()).getTime();
  const waitingOrSkipped = token.status === "WAITING" || token.status === "SKIPPED";

  let ahead = 0;
  let estimatedWaitMinutes = 0;
  if (isToday && waitingOrSkipped) {
    const queue = await loadQueueTokens(db, token.departmentId, token.date);
    const self = queue.find((t) => t.id === token.id);
    ahead = self ? peopleAhead(queue, self) : 0;
    const average = averageConsultMinutes(await recentConsultMinutes(token.departmentId, token.doctorId));
    estimatedWaitMinutes = estimateWaitMinutes(average, ahead);
  }

  return {
    code,
    label: formatTokenNumber(token.department.tokenPrefix, token.seqNo),
    status: token.status,
    isToday,
    department: { nameEn: token.department.nameEn, nameHi: token.department.nameHi },
    doctorName: token.doctor?.displayName ?? null,
    roomName: token.doctor?.room?.name ?? null,
    position: isToday && waitingOrSkipped ? ahead + 1 : null,
    peopleAhead: ahead,
    estimatedWaitMinutes,
    yourTurn: isToday && (token.status === "CALLED" || token.status === "IN_CONSULT"),
  };
}

/** Existing patients with this phone number, for the desk's "search by phone". */
export async function searchPatientsByPhone(phone: string) {
  return db.patient.findMany({
    where: { phone, anonymised: false },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, phone: true, age: true, sex: true, abhaNumber: true },
  });
}
