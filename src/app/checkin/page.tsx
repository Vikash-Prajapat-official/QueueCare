import type { Metadata } from "next";
import { consentNotice, retentionDays } from "@/lib/consent";
import { db } from "@/lib/db";
import { CheckInForm } from "./checkin-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get your token · QueueCare" };

// Public page, opened from the QR poster. No login.
export default async function CheckInPage() {
  const [departments, hospital] = await Promise.all([
    db.department.findMany({
      where: { active: true },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameHi: true },
    }),
    db.hospital.findFirst({ select: { name: true } }),
  ]);
  const notice = consentNotice(retentionDays());

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <header className="pt-2 text-center">
        <p className="text-sm text-muted-foreground">{hospital?.name ?? "QueueCare"}</p>
        <h1 className="text-2xl font-bold text-primary">Get your token</h1>
        <p className="text-lg">अपना टोकन पाएँ</p>
      </header>
      {departments.length === 0 ? (
        <p className="rounded-md bg-muted p-4 text-center">Check-in is not open yet. Please use the registration desk.</p>
      ) : (
        <CheckInForm departments={departments} notice={notice} />
      )}
    </main>
  );
}
