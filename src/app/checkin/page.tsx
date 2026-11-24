import { getLocale, getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/language-toggle";
import { pageTitle } from "@/i18n/meta";
import { consentNotice, retentionDays } from "@/lib/consent";
import { db } from "@/lib/db";
import { CheckInForm } from "./checkin-form";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("checkin");

// Public page, opened from the QR poster. No login.
export default async function CheckInPage() {
  const [departments, hospital, t, locale] = await Promise.all([
    db.department.findMany({
      where: { active: true },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameHi: true },
    }),
    db.hospital.findFirst({ select: { name: true } }),
    getTranslations("checkin"),
    getLocale(),
  ]);
  const notice = consentNotice(retentionDays());

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex justify-end text-primary">
        <LanguageToggle tone="light" />
      </div>
      <header className="text-center">
        <p className="text-sm text-muted-foreground">{hospital?.name ?? "QueueCare"}</p>
        <h1 className="text-2xl font-bold text-primary">{t("title")}</h1>
      </header>
      {departments.length === 0 ? (
        <p className="rounded-md bg-muted p-4 text-center">{t("notOpen")}</p>
      ) : (
        <CheckInForm departments={departments} notice={locale === "hi" ? notice.hi : notice.en} />
      )}
    </main>
  );
}
