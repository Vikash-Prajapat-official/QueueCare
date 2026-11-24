import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pageTitle } from "@/i18n/meta";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("health");

async function check() {
  try {
    await db.$queryRaw`SELECT 1`;
    const [departments, users, tokens] = await Promise.all([
      db.department.count(),
      db.user.count(),
      db.token.count(),
    ]);
    return { ok: true as const, departments, users, tokens };
  } catch {
    return { ok: false as const };
  }
}

// Shows only up/down status and row counts. No names or phone numbers.
export default async function HealthPage() {
  const [r, t] = await Promise.all([check(), getTranslations("health")]);
  return (
    <main className="mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            {t("app")}: <strong className="text-primary">{t("running")}</strong>
          </p>
          <p>
            {t("database")}:{" "}
            <strong className={r.ok ? "text-primary" : "text-destructive"}>
              {r.ok ? t("connected") : t("unreachable")}
            </strong>
          </p>
          {r.ok && (
            <p className="text-sm text-muted-foreground">
              {t("counts", { departments: r.departments, users: r.users, tokens: r.tokens })}
              {r.departments === 0 && ` ${t("runSeed")}`}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
