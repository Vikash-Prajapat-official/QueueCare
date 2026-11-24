// Background jobs that run inside the app: the nightly retention job.
// Started once from instrumentation.ts. Set DISABLE_JOBS=1 to turn them off (tests, CI).

import cron from "node-cron";
import { anonymiseExpiredPatients } from "@/lib/retention";

const holder = globalThis as unknown as { __jobsStarted?: boolean };

async function runRetention(trigger: string) {
  try {
    const count = await anonymiseExpiredPatients();
    console.log(`[retention] ${trigger}: ${count} patient(s) anonymised`);
  } catch (e) {
    console.error(`[retention] ${trigger} failed`, e);
  }
}

export function startJobs() {
  if (holder.__jobsStarted || process.env.DISABLE_JOBS === "1") return;
  holder.__jobsStarted = true;

  // Every night at 02:30 hospital time.
  cron.schedule("30 2 * * *", () => void runRetention("nightly"), {
    timezone: process.env.JOBS_TIMEZONE || "Asia/Kolkata",
  });
  // Also shortly after start, so a server that was switched off at night still catches up.
  setTimeout(() => void runRetention("startup"), 2 * 60_000).unref();
  console.log("[jobs] nightly retention scheduled for 02:30");
}
