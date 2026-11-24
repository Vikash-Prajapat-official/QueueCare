import { getLocale, getTranslations } from "next-intl/server";
import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { pageTitle } from "@/i18n/meta";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const generateMetadata = pageTitle("doctors");

export default async function DoctorsPage() {
  await requirePageRole(["ADMIN"]);
  const [t, locale] = await Promise.all([getTranslations("admin.doctors"), getLocale()]);
  const deptName = (d: { nameEn: string; nameHi: string }) => (locale === "hi" ? d.nameHi : d.nameEn);
  const dept = { select: { nameEn: true, nameHi: true } };
  const [doctors, freeUsers, departments, rooms] = await Promise.all([
    db.doctor.findMany({
      include: {
        user: { select: { name: true, phone: true } },
        department: dept,
        room: { select: { name: true } },
      },
      orderBy: { displayName: "asc" },
    }),
    // Doctor-role users who do not have a doctor profile yet
    db.user.findMany({ where: { role: "DOCTOR", active: true, doctor: null }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
    db.room.findMany({ include: { department: dept }, orderBy: { name: "asc" } }),
  ]);
  const rows = doctors.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    roomId: d.roomId,
    login: `${d.user.name} (${d.user.phone})`,
    departmentName: deptName(d.department),
    roomName: d.room?.name ?? null,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <AdminCrud
        noun={t("noun")}
        endpoint="/api/admin/doctors"
        intro={t("intro")}
        rows={rows as Row[]}
        columns={[
          { header: t("displayName"), key: "displayName" },
          { header: t("login"), key: "login" },
          { header: t("department"), key: "departmentName" },
          { header: t("room"), key: "roomName" },
        ]}
        fields={[
          {
            name: "userId",
            label: t("doctorLogin"),
            type: "select",
            required: true,
            onEdit: false,
            options: freeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.phone})` })),
            help: freeUsers.length === 0 ? t("noFreeUsers") : undefined,
          },
          { name: "displayName", label: t("displayName"), type: "text", required: true, help: t("displayNameHelp") },
          {
            name: "departmentId",
            label: t("department"),
            type: "select",
            required: true,
            onEdit: false,
            options: departments.map((d) => ({ value: d.id, label: deptName(d) })),
          },
          {
            name: "roomId",
            label: t("room"),
            type: "select",
            nullable: true,
            options: rooms.map((r) => ({ value: r.id, label: `${deptName(r.department)} · ${r.name}` })),
            help: t("roomHelp"),
          },
        ]}
      />
    </div>
  );
}
