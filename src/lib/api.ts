import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/rbac";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** For 429 answers: sent as the Retry-After header. */
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export interface AuthedUser {
  id: string;
  name: string;
  role: Role;
  departmentId: string | null;
}

/**
 * Server-side role check for every protected API route.
 * Re-reads the user from the database so a deactivated user or a changed role takes effect
 * immediately, not when the session cookie expires.
 */
export async function requireRole(
  allowed: readonly Role[],
  opts: { allowPasswordChangePending?: boolean } = {},
): Promise<AuthedUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, "UNAUTHENTICATED", "Please log in.");

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, active: true, departmentId: true, mustChangePassword: true },
  });
  if (!user || !user.active) throw new ApiError(401, "UNAUTHENTICATED", "Please log in.");

  if (user.mustChangePassword && !opts.allowPasswordChangePending) {
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "You must change your password first.");
  }
  if (!allowed.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this.");
  }
  return { id: user.id, name: user.name, role: user.role, departmentId: user.departmentId };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON.");
  }
}

export function errorResponse(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

function prismaCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string") {
    return (e as { code: string }).code;
  }
  return undefined;
}

export function toErrorResponse(e: unknown) {
  if (e instanceof ApiError) {
    const headers = e.retryAfterSeconds ? { "Retry-After": String(e.retryAfterSeconds) } : undefined;
    return errorResponse(e.status, e.code, e.message, headers);
  }
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const where = first && first.path.length ? `${first.path.join(".")}: ` : "";
    return errorResponse(400, "VALIDATION", `${where}${first?.message ?? "Invalid input"}`);
  }
  switch (prismaCode(e)) {
    case "P2002":
      return errorResponse(409, "CONFLICT", "A record with the same unique value already exists.");
    case "P2003":
      return errorResponse(400, "BAD_REFERENCE", "A referenced record does not exist.");
    case "P2025":
      return errorResponse(404, "NOT_FOUND", "Record not found.");
  }
  console.error(e);
  return errorResponse(500, "INTERNAL", "Something went wrong.");
}

/** Wraps a route handler so every thrown error becomes `{ error: { code, message } }`. */
export function route<Ctx = unknown>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
