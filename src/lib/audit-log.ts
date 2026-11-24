import { db } from "@/lib/db";
import { hospitalTimezone } from "@/lib/report-service";
import { addDays, formatLocal, isValidYmd, startOfLocalDay } from "@/lib/time";

export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilter {
  from?: string;
  to?: string;
  /** Matches actions that start with this text, for example "queue." or "login". */
  action?: string;
  page?: number;
}

export interface AuditRow {
  id: string;
  /** Hospital local time, YYYY-MM-DD HH:mm:ss */
  at: string;
  who: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
}

/** The audit log, newest first. It holds who did what and when, never names or phone numbers of patients. */
export async function listAuditLogs(filter: AuditFilter) {
  const timeZone = await hospitalTimezone();
  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const action = filter.action?.trim().slice(0, 40);

  const at: { gte?: Date; lt?: Date } = {};
  if (filter.from && isValidYmd(filter.from)) at.gte = startOfLocalDay(filter.from, timeZone);
  if (filter.to && isValidYmd(filter.to)) at.lt = startOfLocalDay(addDays(filter.to, 1), timeZone);

  const where = {
    ...(at.gte || at.lt ? { at } : {}),
    ...(action ? { action: { startsWith: action } } : {}),
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        at: true,
        action: true,
        entity: true,
        entityId: true,
        ip: true,
        actor: { select: { name: true, role: true } },
      },
    }),
  ]);

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    at: formatLocal(l.at, timeZone),
    who: l.actor ? `${l.actor.name} (${l.actor.role.toLowerCase()})` : l.action === "checkin" ? "Patient (self check-in)" : "System",
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    ip: l.ip,
  }));
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), timeZone };
}
