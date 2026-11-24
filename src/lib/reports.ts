// Report maths, as pure functions. The database side is in report-service.ts.

import { MAX_CONSULT_MINUTES, consultMinutes } from "@/lib/queue";
import { addDays, daysInRange, eachDay, isValidYmd } from "@/lib/time";

export const MAX_REPORT_DAYS = 92;
export const MAX_EXPORT_DAYS = 366;

export interface ReportToken {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  departmentId: string;
  status: string;
  source: string;
  createdAt: Date;
  calledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface DepartmentInfo {
  id: string;
  nameEn: string;
  tokenPrefix: string;
}

export interface Stats {
  total: number;
  done: number;
  noShow: number;
  cancelled: number;
  /** Still waiting, called, in consultation or skipped. */
  open: number;
  selfCheckIn: number;
  /** Minutes from getting a token to being called. Null when nobody was called. */
  avgWaitMinutes: number | null;
  /** Minutes from start to finish of a consultation. Null when none finished. */
  avgConsultMinutes: number | null;
}

export interface Report {
  from: string;
  to: string;
  departments: DepartmentInfo[];
  days: { date: string; departments: ({ departmentId: string } & Stats)[]; totals: Stats }[];
  byDepartment: ({ departmentId: string } & Stats)[];
  totals: Stats;
}

type Range = { ok: true; from: string; to: string } | { ok: false; message: string };

/** Picks the date range. Missing dates default to the last 7 days ending today. */
export function resolveRange(
  from: string | null | undefined,
  to: string | null | undefined,
  today: string,
  maxDays: number,
): Range {
  const end = to || today;
  const start = from || addDays(end, -6);
  if (!isValidYmd(start) || !isValidYmd(end)) return { ok: false, message: "Dates must look like 2026-11-24." };
  if (start > end) return { ok: false, message: "The start date is after the end date." };
  if (daysInRange(start, end) > maxDays) return { ok: false, message: `Choose at most ${maxDays} days at a time.` };
  return { ok: true, from: start, to: end };
}

const OPEN = new Set(["WAITING", "CALLED", "IN_CONSULT", "SKIPPED"]);
const WAIT_COUNTS = new Set(["CALLED", "IN_CONSULT", "DONE", "NO_SHOW"]);

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

function summarise(tokens: readonly ReportToken[]): Stats {
  const waits: number[] = [];
  const consults: number[] = [];
  for (const t of tokens) {
    if (t.calledAt && WAIT_COUNTS.has(t.status)) {
      const wait = (t.calledAt.getTime() - t.createdAt.getTime()) / 60_000;
      if (wait >= 0) waits.push(wait);
    }
    if (t.status === "DONE") {
      const minutes = consultMinutes(t.startedAt, t.completedAt);
      if (minutes !== null && minutes > 0 && minutes <= MAX_CONSULT_MINUTES) consults.push(minutes);
    }
  }
  return {
    total: tokens.length,
    done: tokens.filter((t) => t.status === "DONE").length,
    noShow: tokens.filter((t) => t.status === "NO_SHOW").length,
    cancelled: tokens.filter((t) => t.status === "CANCELLED").length,
    open: tokens.filter((t) => OPEN.has(t.status)).length,
    selfCheckIn: tokens.filter((t) => t.source === "SELF").length,
    avgWaitMinutes: mean(waits),
    avgConsultMinutes: mean(consults),
  };
}

export function buildReport(
  tokens: readonly ReportToken[],
  departments: readonly DepartmentInfo[],
  from: string,
  to: string,
): Report {
  const byDate = new Map<string, ReportToken[]>();
  for (const t of tokens) {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  }

  const days = eachDay(from, to).map((date) => {
    const dayTokens = byDate.get(date) ?? [];
    return {
      date,
      departments: departments.map((d) => ({
        departmentId: d.id,
        ...summarise(dayTokens.filter((t) => t.departmentId === d.id)),
      })),
      totals: summarise(dayTokens),
    };
  });

  return {
    from,
    to,
    departments: [...departments],
    days,
    byDepartment: departments.map((d) => ({
      departmentId: d.id,
      ...summarise(tokens.filter((t) => t.departmentId === d.id)),
    })),
    totals: summarise(tokens),
  };
}
