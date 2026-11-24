import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pageTitle } from "@/i18n/meta";
import { CONSENT_NOTICE_VERSION, consentNotice, retentionDays } from "@/lib/consent";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";
import { hospitalTimezone } from "@/lib/report-service";
import { formatLocal } from "@/lib/time";
import { PrivacyTools } from "./privacy-tools";

export const generateMetadata = pageTitle("privacy");
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("admin.privacy");
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
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("retentionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            {t.rich("retentionText", {
              days,
              b: (chunks) => <strong>{chunks}</strong>,
              code: (chunks) => <code>{chunks}</code>,
            })}
          </p>
          <p className="text-muted-foreground">
            {t("retentionStatus", {
              anonymised,
              total,
              lastRun: lastRun ? `${formatLocal(lastRun.at, timeZone)} (${lastRun.entityId})` : t("notYet"),
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("consentTitle", { version: CONSENT_NOTICE_VERSION, count: consents })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p lang="en">{notice.en}</p>
          <p lang="hi">{notice.hi}</p>
          <p className="text-muted-foreground">{t("consentHelp")}</p>
        </CardContent>
      </Card>

      <PrivacyTools />
    </div>
  );
}
