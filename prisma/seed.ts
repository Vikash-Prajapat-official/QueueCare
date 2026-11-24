import { PrismaClient, type Priority, type Sex, type TokenStatus, type VisitType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateTokenCode } from "../src/lib/token-code";

const prisma = new PrismaClient();

// Demo logins, printed in README. Every seeded user must change the password on first login.
const DEFAULT_PASSWORD = "queuecare123";

const DEPARTMENTS = [
  { prefix: "MED", nameEn: "Medicine", nameHi: "चिकित्सा", color: "#0F766E", room: "Room 4", doctor: "Dr. Anil Sharma", phone: "9000000011" },
  { prefix: "PED", nameEn: "Paediatrics", nameHi: "बाल रोग", color: "#2563EB", room: "Room 5", doctor: "Dr. Neha Verma", phone: "9000000012" },
  { prefix: "GYN", nameEn: "Gynaecology", nameHi: "स्त्री रोग", color: "#C026D3", room: "Room 6", doctor: "Dr. Sunita Rao", phone: "9000000013" },
  { prefix: "ORT", nameEn: "Orthopaedics", nameHi: "अस्थि रोग", color: "#EA580C", room: "Room 7", doctor: "Dr. Rakesh Gupta", phone: "9000000014" },
];

const FIRST = ["Aarav", "Sita", "Ramesh", "Priya", "Mohan", "Kavita", "Suresh", "Anjali", "Vijay", "Meena", "Rahul", "Pooja", "Imran", "Fatima", "Gurpreet"];
const LAST = ["Kumar", "Devi", "Singh", "Patel", "Yadav", "Khan", "Das", "Mishra", "Joshi", "Reddy"];
const SEXES: Sex[] = ["M", "F", "O"];
const PRIORITIES: Priority[] = ["NORMAL", "NORMAL", "NORMAL", "NORMAL", "ELDERLY", "PREGNANT", "DISABLED", "EMERGENCY"];

/** Today's date at UTC midnight, taken from the hospital's local calendar date (Asia/Kolkata). */
function today(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  if ((await prisma.hospital.count()) === 0) {
    await prisma.hospital.create({
      data: { name: "Demo District Hospital", address: "Main Road, Demo City", timezone: "Asia/Kolkata" },
    });
  }

  const userData = (name: string, phone: string, role: "ADMIN" | "CLERK" | "DOCTOR", departmentId?: string) => ({
    name,
    phone,
    role,
    passwordHash,
    departmentId,
    // Set SEED_DEMO_LOGINS=1 only for a public demo, so visitors are not forced to change the shared password.
    mustChangePassword: process.env.SEED_DEMO_LOGINS !== "1",
  });

  await prisma.user.upsert({
    where: { phone: "9000000001" },
    update: {},
    create: userData("Hospital Admin", "9000000001", "ADMIN"),
  });
  for (const [i, name] of ["Desk Clerk 1", "Desk Clerk 2"].entries()) {
    const phone = `900000002${i + 1}`;
    await prisma.user.upsert({ where: { phone }, update: {}, create: userData(name, phone, "CLERK") });
  }

  const doctorByDept = new Map<string, string>();
  const deptIds: string[] = [];

  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { tokenPrefix: d.prefix },
      update: {},
      create: { tokenPrefix: d.prefix, nameEn: d.nameEn, nameHi: d.nameHi, color: d.color },
    });
    deptIds.push(dept.id);

    let room = await prisma.room.findFirst({ where: { departmentId: dept.id, name: d.room } });
    if (!room) room = await prisma.room.create({ data: { name: d.room, departmentId: dept.id } });

    const user = await prisma.user.upsert({
      where: { phone: d.phone },
      update: {},
      create: userData(d.doctor, d.phone, "DOCTOR", dept.id),
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, departmentId: dept.id, roomId: room.id, displayName: d.doctor },
    });
    doctorByDept.set(dept.id, doctor.id);

    if ((await prisma.opdSession.count({ where: { departmentId: dept.id } })) === 0) {
      // Monday to Saturday, 09:00 to 13:00
      await prisma.opdSession.createMany({
        data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
          departmentId: dept.id,
          doctorId: doctor.id,
          weekday,
          startTime: "09:00",
          endTime: "13:00",
        })),
      });
    }
  }

  // 50 demo tokens for today, only if there are none yet (keeps the seed re-runnable).
  const date = today();
  if ((await prisma.token.count({ where: { date } })) === 0) {
    const counters = new Map<string, number>();

    for (let i = 0; i < 50; i++) {
      const departmentId = deptIds[i % deptIds.length]!;
      const seqNo = (counters.get(departmentId) ?? 0) + 1;
      counters.set(departmentId, seqNo);

      const age = 5 + ((i * 7) % 80);
      const patient = await prisma.patient.create({
        data: {
          name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
          phone: `98765${String(10000 + i).slice(-5)}`,
          age,
          sex: SEXES[i % 3]!,
        },
      });
      await prisma.consentRecord.create({
        data: { patientId: patient.id, purpose: "OPD queue", noticeVersion: "v1", channel: "DESK" },
      });

      // The first 3 tokens of each department are already done, so reports have data.
      const status: TokenStatus = seqNo <= 3 ? "DONE" : "WAITING";
      const now = Date.now();
      await prisma.token.create({
        data: {
          code: generateTokenCode(),
          seqNo,
          date,
          departmentId,
          doctorId: doctorByDept.get(departmentId),
          patientId: patient.id,
          visitType: (i % 3 === 0 ? "FOLLOW_UP" : "NEW") as VisitType,
          priority: age >= 60 ? "ELDERLY" : PRIORITIES[i % PRIORITIES.length]!,
          status,
          source: i % 4 === 0 ? "SELF" : "DESK",
          calledAt: status === "DONE" ? new Date(now - 20 * 60_000) : null,
          startedAt: status === "DONE" ? new Date(now - 18 * 60_000) : null,
          completedAt: status === "DONE" ? new Date(now - 10 * 60_000) : null,
        },
      });
    }
  }

  // The six days before today: finished visits with plausible waits and consult times, so the
  // Reports screen has a real chart on a fresh install. Only added when there is no earlier history.
  if ((await prisma.token.count({ where: { date: { lt: date } } })) === 0) {
    const pool = await prisma.patient.findMany({ take: 30, select: { id: true } });
    const consultBase: Record<string, number> = { MED: 9, PED: 7, GYN: 11, ORT: 8 };
    for (let back = 6; back >= 1; back--) {
      const day = new Date(date.getTime() - back * 86_400_000);
      if (day.getUTCDay() === 0) continue; // Sunday: no OPD
      const counters = new Map<string, number>();
      const perDay = 14 + ((back * 5) % 9);
      for (let i = 0; i < perDay; i++) {
        const di = (i + back) % deptIds.length;
        const departmentId = deptIds[di]!;
        const prefix = DEPARTMENTS[di]!.prefix;
        const seqNo = (counters.get(departmentId) ?? 0) + 1;
        counters.set(departmentId, seqNo);

        // Registered between 09:00 and 12:00 hospital time (UTC+5:30), a few minutes apart.
        const created = new Date(day.getTime() + (9 * 60 - 330) * 60_000 + i * 11 * 60_000);
        const wait = 6 + ((i * 7 + back * 3) % 30); // 6 to 35 minutes
        const consult = (consultBase[prefix] ?? 8) + ((i * 5) % 7);
        const noShow = i % 11 === 10;
        const called = new Date(created.getTime() + wait * 60_000);
        await prisma.token.create({
          data: {
            code: generateTokenCode(),
            seqNo,
            date: day,
            departmentId,
            doctorId: doctorByDept.get(departmentId),
            patientId: pool[(i * 3 + back) % pool.length]!.id,
            visitType: i % 3 === 0 ? "FOLLOW_UP" : "NEW",
            priority: i % 8 === 4 ? "ELDERLY" : "NORMAL",
            status: noShow ? "NO_SHOW" : "DONE",
            source: i % 4 === 0 ? "SELF" : "DESK",
            createdAt: created,
            calledAt: called,
            startedAt: noShow ? null : new Date(called.getTime() + 60_000),
            completedAt: noShow ? null : new Date(called.getTime() + (1 + consult) * 60_000),
          },
        });
      }
    }
  }

  const [departments, users, tokens] = await Promise.all([
    prisma.department.count(),
    prisma.user.count(),
    prisma.token.count(),
  ]);
  console.log(`Seed complete: ${departments} departments, ${users} users, ${tokens} tokens.`);
  console.log(
    `Demo logins (password "${DEFAULT_PASSWORD}", change on first login): admin 9000000001, clerks 9000000021/22, doctors 9000000011-14.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
