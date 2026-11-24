import { E2E, e2eDb } from "./db";

// After the tests: hide the test department and switch the test logins off, so a demo or
// development database does not keep showing them. (Run the tests on a throw-away database
// in CI; on a real hospital database do not run them at all.)
export default async function globalTeardown() {
  const db = e2eDb();
  try {
    await db.token.updateMany({
      where: { department: { tokenPrefix: E2E.prefix }, status: { in: ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED"] } },
      data: { status: "CANCELLED" },
    });
    await db.department.updateMany({ where: { tokenPrefix: E2E.prefix }, data: { active: false } });
    await db.user.updateMany({ where: { phone: { in: [E2E.clerkPhone, E2E.doctorPhone] } }, data: { active: false } });
  } finally {
    await db.$disconnect();
  }
}
