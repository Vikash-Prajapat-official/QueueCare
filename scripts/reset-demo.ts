// Resets a PUBLIC DEMO database: erases every row and loads the sample data again.
//   DATABASE_URL=<demo database> DEMO_MODE=1 npx tsx scripts/reset-demo.ts
// It refuses to run unless DEMO_MODE=1 is set, so it cannot be run against a real hospital by accident.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.DEMO_MODE !== "1") {
    console.error("Refusing to run: this erases ALL data. Set DEMO_MODE=1 only for a public demo database.");
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
    console.log(`Erased ${rows.length} tables.`);
  } finally {
    await db.$disconnect();
  }
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, SEED_DEMO_LOGINS: "1" } });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
