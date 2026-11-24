import bcrypt from "bcryptjs";
import { E2E, e2eDb } from "./db";

// Before the tests: a test department with its own room, clerk and doctor (known password, no forced
// password change), and no unfinished tokens in it, so the first "Next" always calls our patient.
export default async function globalSetup() {
  const db = e2eDb();
  try {
    const passwordHash = await bcrypt.hash(E2E.password, 4); // low cost: this is test data
    const dept = await db.department.upsert({
      where: { tokenPrefix: E2E.prefix },
      update: { active: true },
      create: { tokenPrefix: E2E.prefix, nameEn: "E2E Test Dept", nameHi: "परीक्षण विभाग", color: "#0F766E" },
    });

    let room = await db.room.findFirst({ where: { departmentId: dept.id, name: "E2E Room" } });
    if (!room) room = await db.room.create({ data: { departmentId: dept.id, name: "E2E Room" } });

    const user = (name: string, phone: string, role: "CLERK" | "DOCTOR", departmentId?: string) =>
      db.user.upsert({
        where: { phone },
        update: { passwordHash, active: true, mustChangePassword: false, role },
        create: { name, phone, role, passwordHash, departmentId, mustChangePassword: false },
      });
    await user("E2E Clerk", E2E.clerkPhone, "CLERK");
    const doctorUser = await user("E2E Doctor", E2E.doctorPhone, "DOCTOR", dept.id);
    await db.doctor.upsert({
      where: { userId: doctorUser.id },
      update: { departmentId: dept.id, roomId: room.id },
      create: { userId: doctorUser.id, departmentId: dept.id, roomId: room.id, displayName: "Dr. E2E" },
    });

    await db.token.updateMany({
      where: { departmentId: dept.id, status: { in: ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED"] } },
      data: { status: "CANCELLED" },
    });
  } finally {
    await db.$disconnect();
  }
}
