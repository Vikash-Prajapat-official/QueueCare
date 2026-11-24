import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export function clientIp(req?: Request): string | null {
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
  // Pass the transaction client to write the log in the same transaction as the change.
  client: Prisma.TransactionClient = db,
) {
  await client.auditLog.create({
    data: { actorUserId, action, entity, entityId, ip: clientIp(req) },
  });
}
