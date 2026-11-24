// Creates the first administrator (and the hospital record) on a new install that was not seeded.
//   docker compose exec app npx tsx scripts/create-admin.ts 9876543210 "Admin Name"
// Prints a temporary password once. The admin must choose their own at first login.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const [phone, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim() || "Administrator";
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    console.error('Usage: npx tsx scripts/create-admin.ts <10-digit mobile number> "Admin Name"');
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    if (await db.user.findUnique({ where: { phone } })) {
      console.error(`A user with the phone number ${phone} already exists.`);
      process.exit(1);
    }
    if ((await db.hospital.count()) === 0) {
      await db.hospital.create({ data: { name: "My Hospital", address: "", timezone: "Asia/Kolkata" } });
    }
    const temporary = randomBytes(6).toString("base64url"); // 8 characters
    await db.user.create({
      data: { name, phone, role: "ADMIN", mustChangePassword: true, passwordHash: await bcrypt.hash(temporary, 12) },
    });
    console.log(`Administrator created: ${name}, phone ${phone}`);
    console.log(`Temporary password (shown once): ${temporary}`);
    console.log("They must choose their own password at first login.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
