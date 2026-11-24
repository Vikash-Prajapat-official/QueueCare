// Queue engine: pure functions only (no database, no clock), so every rule is unit tested.
// The database side lives in queue-service.ts and calls these functions.

import type { Role } from "@/lib/rbac";

export const PRIORITIES = ["NORMAL", "ELDERLY", "PREGNANT", "DISABLED", "EMERGENCY"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TOKEN_STATUSES = ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED", "NO_SHOW", "DONE", "CANCELLED"] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

/** A skipped patient comes back after this many other patients have been called. */
export const SKIP_HOLD = 3;
/** Used for the wait estimate until a doctor has finished any consultations. */
export const DEFAULT_CONSULT_MINUTES = 10;
/** The estimate uses the last 20 consultations of the doctor. */
export const CONSULT_WINDOW = 20;
/** A consultation longer than this is treated as a forgotten "Complete" press and ignored. */
export const MAX_CONSULT_MINUTES = 180;

export interface QueueToken {
  id: string;
  seqNo: number;
  priority: Priority;
  status: TokenStatus;
  /** Calls still to be made before a SKIPPED token returns to WAITING. */
  skipHold: number;
  /** The doctor the token is assigned to, or null if any doctor of the department may take it. */
  doctorId: string | null;
}

// ------------------------------------------------------------------ ordering

/** 0 = EMERGENCY, 1 = ELDERLY / PREGNANT / DISABLED, 2 = NORMAL. Lower is called first. */
export function priorityGroup(priority: Priority): 0 | 1 | 2 {
  if (priority === "EMERGENCY") return 0;
  if (priority === "NORMAL") return 2;
  return 1;
}

type Sortable = Pick<QueueToken, "id" | "seqNo" | "priority">;

/** Call order: priority group first, then token number. The id only makes the order stable. */
export function compareForCall(a: Sortable, b: Sortable): number {
  return (
    priorityGroup(a.priority) - priorityGroup(b.priority) ||
    a.seqNo - b.seqNo ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function sortWaiting<T extends Sortable>(tokens: readonly T[]): T[] {
  return [...tokens].sort(compareForCall);
}

/**
 * Waiting patients one doctor may call, in call order: those assigned to the doctor plus
 * those not assigned to anyone. With no doctor (null) it is the whole department.
 */
export function eligibleQueue<T extends QueueToken>(tokens: readonly T[], doctorId: string | null): T[] {
  return sortWaiting(
    tokens.filter(
      (t) => t.status === "WAITING" && (doctorId === null || t.doctorId === null || t.doctorId === doctorId),
    ),
  );
}

export function pickNext<T extends QueueToken>(tokens: readonly T[], doctorId: string): T | undefined {
  return eligibleQueue(tokens, doctorId)[0];
}

// ---------------------------------------------------------------- skip re-entry

/** How many calls a skipped patient waits: 3, or fewer if fewer patients are waiting. */
export function holdForSkip(waitingCount: number): number {
  return Math.max(0, Math.min(SKIP_HOLD, waitingCount));
}

/** Called after each patient is called: counts every held token down and says which return. */
export function releaseAfterCall(
  held: readonly { id: string; skipHold: number }[],
): { id: string; skipHold: number; release: boolean }[] {
  return held.map((h) => {
    const skipHold = Math.max(0, h.skipHold - 1);
    return { id: h.id, skipHold, release: skipHold === 0 };
  });
}

/**
 * The order in which a doctor's patients will be called if nobody else arrives.
 * Skipped patients return to the queue, with their own priority and token number,
 * after the right number of calls (or at once when nobody else is waiting).
 */
export function predictCallOrder<T extends QueueToken>(tokens: readonly T[], doctorId: string | null): T[] {
  let waiting = eligibleQueue(tokens, doctorId);
  let held = tokens
    .filter((t) => t.status === "SKIPPED" && (doctorId === null || t.doctorId === null || t.doctorId === doctorId))
    .map((token) => ({ token, hold: token.skipHold }));
  const order: T[] = [];

  while (waiting.length > 0 || held.length > 0) {
    if (waiting.length === 0) {
      waiting = sortWaiting(held.map((h) => h.token));
      held = [];
      continue;
    }
    order.push(waiting[0] as T);
    waiting = waiting.slice(1);

    held = held.map((h) => ({ ...h, hold: h.hold - 1 }));
    const back = held.filter((h) => h.hold <= 0);
    if (back.length > 0) {
      held = held.filter((h) => h.hold > 0);
      waiting = sortWaiting([...waiting, ...back.map((h) => h.token)]);
    }
  }
  return order;
}

/** How many patients will be called before this one. Zero if they are being seen or are finished. */
export function peopleAhead<T extends QueueToken>(tokens: readonly T[], token: T): number {
  if (token.status !== "WAITING" && token.status !== "SKIPPED") return 0;
  const index = predictCallOrder(tokens, token.doctorId).findIndex((t) => t.id === token.id);
  return index < 0 ? 0 : index;
}

// ------------------------------------------------------------- numbers and dates

/** The hospital's local calendar date as a UTC-midnight Date (what the `tokens.date` column stores). */
export function localDate(now: Date, timeZone = "Asia/Kolkata"): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Next token number for a department on a given day. Pass the highest number used that day. */
export function nextSeqNo(highestToday: number | null | undefined): number {
  return (highestToday ?? 0) + 1;
}

export function formatTokenNumber(prefix: string, seqNo: number): string {
  return `${prefix}-${String(seqNo).padStart(3, "0")}`;
}

// -------------------------------------------------------------- estimated wait

export function consultMinutes(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) return null;
  return (completedAt.getTime() - startedAt.getTime()) / 60_000;
}

/** Rolling average over the last 20 consultations. `minutes` is newest first. */
export function averageConsultMinutes(minutes: readonly number[], fallback = DEFAULT_CONSULT_MINUTES): number {
  const valid = minutes.slice(0, CONSULT_WINDOW).filter((m) => m > 0 && m <= MAX_CONSULT_MINUTES);
  if (valid.length === 0) return fallback;
  return valid.reduce((sum, m) => sum + m, 0) / valid.length;
}

export function estimateWaitMinutes(averageMinutes: number, ahead: number): number {
  return Math.round(averageMinutes * ahead);
}

// ------------------------------------------------------------------ move rules

/** Allowed status moves. CANCELLED is handled separately (see canCancelFrom). */
export const MOVES: Record<TokenStatus, readonly TokenStatus[]> = {
  WAITING: ["CALLED"],
  CALLED: ["IN_CONSULT", "SKIPPED", "NO_SHOW"],
  IN_CONSULT: ["DONE"],
  SKIPPED: ["WAITING"], // automatic, once the hold has run out
  NO_SHOW: [],
  DONE: [],
  CANCELLED: [],
};

/** A token can be cancelled until it is finished. Done, no-show and cancelled tokens are final. */
export function canCancelFrom(from: TokenStatus): boolean {
  return from === "WAITING" || from === "CALLED" || from === "IN_CONSULT" || from === "SKIPPED";
}

export function canMove(from: TokenStatus, to: TokenStatus): boolean {
  if (to === "CANCELLED") return canCancelFrom(from);
  return MOVES[from].includes(to);
}

// ------------------------------------------------------------------ actions

export const QUEUE_ACTIONS = ["next", "skip", "recall", "no-show", "start", "complete", "transfer", "cancel"] as const;
export type QueueAction = (typeof QUEUE_ACTIONS)[number];
export type TokenAction = Exclude<QueueAction, "next">;

const DOCTOR_AND_DESK: readonly Role[] = ["DOCTOR", "CLERK", "ADMIN"];

export const ACTION_ROLES: Record<QueueAction, readonly Role[]> = {
  next: ["DOCTOR"],
  skip: DOCTOR_AND_DESK,
  recall: DOCTOR_AND_DESK,
  "no-show": DOCTOR_AND_DESK,
  start: DOCTOR_AND_DESK,
  complete: DOCTOR_AND_DESK,
  transfer: DOCTOR_AND_DESK,
  cancel: ["CLERK", "ADMIN"],
};

/** The status a token must be in for each action. */
export const ACTION_FROM: Record<TokenAction, readonly TokenStatus[]> = {
  skip: ["CALLED"],
  recall: ["CALLED"],
  "no-show": ["CALLED"],
  start: ["CALLED"],
  complete: ["IN_CONSULT"],
  transfer: ["WAITING"],
  cancel: ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED"],
};

export function canPerform(action: QueueAction, role: Role): boolean {
  return ACTION_ROLES[action].includes(role);
}
