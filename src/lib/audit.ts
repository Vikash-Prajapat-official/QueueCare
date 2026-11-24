import { db } from "@/lib/db";

function clientIp(req?: Request): string | null {
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

/** Writes one AuditLog row. Never put personal data (names, phones) in `action`. */
export async function audit(
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  req?: Request,
) {
  await db.auditLog.create({
    data: { actorUserId, action, entity, entityId, ip: clientIp(req) },
  });
}
