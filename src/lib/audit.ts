import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * The visitor's IP: the first x-forwarded-for value, which Caddy sets to the real address, or the
 * connection address Next.js fills in. Without a proxy a visitor can send this header themselves,
 * so per-IP limits are only dependable behind Caddy. (On Docker Desktop for Windows or Mac every
 * device on the network shows up as one gateway address.)
 */
export function ipFromHeaders(headers: Headers): string | null {
  const raw = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || null;
  return raw ? raw.slice(0, 64) : null;
}

export function clientIp(req?: Request): string | null {
  return req ? ipFromHeaders(req.headers) : null;
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
