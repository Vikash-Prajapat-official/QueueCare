import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const generateMetadata = pageTitle("admin");

export default async function AdminHome() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("admin.home");
  const [departments, rooms, doctors, sessions, users] = await Promise.all([
    db.department.count(),
    db.room.count(),
    db.doctor.count(),
    db.opdSession.count(),
    db.user.count(),
  ]);
  const sections = [
    { href: "/admin/departments", label: t("departments"), count: departments, hint: t("departmentsHint") },
    { href: "/admin/rooms", label: t("rooms"), count: rooms, hint: t("roomsHint") },
    { href: "/admin/doctors", label: t("doctors"), count: doctors, hint: t("doctorsHint") },
    { href: "/admin/sessions", label: t("sessions"), count: sessions, hint: t("sessionsHint") },
    { href: "/admin/users", label: t("users"), count: users, hint: t("usersHint") },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
            <Card className="h-full transition-colors hover:bg-muted">
              <CardHeader>
                <CardTitle>{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{s.count}</p>
                <p className="text-sm text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
