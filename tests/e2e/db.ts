// Direct database access for the end-to-end tests: they create their own test department and
// logins, so they never depend on (or change) the demo passwords.
import { PrismaClient } from "@prisma/client";

export const E2E = {
  password: "E2e-Pass-2026!",
  clerkPhone: "9100000002",
  doctorPhone: "9100000003",
  prefix: "TST",
};

/** The tests run on your machine, so the database host "db" (Docker's name) becomes localhost. */
export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL (or DATABASE_URL) so the tests can reach the database.");
  return url.replace("@db:", "@localhost:");
}

export function e2eDb(): PrismaClient {
  return new PrismaClient({ datasourceUrl: e2eDatabaseUrl() });
}

export async function testDepartmentId(): Promise<string> {
  const db = e2eDb();
  try {
    const dept = await db.department.findUniqueOrThrow({ where: { tokenPrefix: E2E.prefix }, select: { id: true } });
    return dept.id;
  } finally {
    await db.$disconnect();
  }
}

export function displayKey(): string {
  const key = process.env.DISPLAY_KEY;
  if (!key) throw new Error("DISPLAY_KEY is not set (it is read from .env or the environment).");
  return key;
}
