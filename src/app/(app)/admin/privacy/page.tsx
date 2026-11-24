import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONSENT_NOTICE_VERSION, consentNotice, retentionDays } from "@/lib/consent";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";
import { hospitalTimezone } from "@/lib/report-service";
import { formatLocal } from "@/lib/time";
import { PrivacyTools } from "./privacy-tools";

export const metadata = { title: "Privacy · QueueCare" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  await requirePageRole(["ADMIN"]);
  const days = retentionDays();
  const notice = consentNotice(days);
  const [timeZone, lastRun, anonymised, total, consents] = await Promise.all([
    hospitalTimezone(),
    db.auditLog.findFirst({ where: { action: "retention.run" }, orderBy: { at: "desc" }, select: { at: true, entityId: true } }),
    db.patient.count({ where: { anonymised: true } }),
    db.patient.count(),
    db.consentRecord.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Privacy</h1>

      <Card>
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Each night at 02:30, patients not seen for <strong>{days} days</strong> lose their name, phone number and ABHA
            number. Visit counts and times are kept, so reports stay correct. Change <code>RETENTION_DAYS</code> in the .env
            file to use a different number of days.
          </p>
          <p className="text-muted-foreground">
            {anonymised} of {total} patients are anonymised. Last run:{" "}
            {lastRun ? `${formatLocal(lastRun.at, timeZone)} (${lastRun.entityId})` : "not yet (it also runs 2 minutes after the app starts)"}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Consent notice ({CONSENT_NOTICE_VERSION}) · {consents} consents recorded
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{notice.en}</p>
          <p>{notice.hi}</p>
          <p className="text-muted-foreground">
            This is shown at the desk and on the check-in page. Each token stores the version the patient agreed to, the
            time, and whether it was at the desk or on their own phone.
          </p>
        </CardContent>
      </Card>

      <PrivacyTools />
    </div>
  );
}
