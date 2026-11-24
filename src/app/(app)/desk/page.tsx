import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/meta";
import { consentNotice, retentionDays } from "@/lib/consent";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";
import { listDepartments } from "@/lib/queue-service";
import { NewTokenForm } from "./new-token-form";

export const generateMetadata = pageTitle("newToken");

export default async function DeskPage() {
  await requirePageRole(["ADMIN", "CLERK"]);
  const t = await getTranslations("desk");
  const [departments, hospital] = await Promise.all([
    listDepartments(),
    db.hospital.findFirst({ select: { name: true } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <NewTokenForm
        departments={departments}
        hospitalName={hospital?.name ?? "QueueCare"}
        appUrl={process.env.APP_URL ?? ""}
        notice={consentNotice(retentionDays())}
      />
    </div>
  );
}
