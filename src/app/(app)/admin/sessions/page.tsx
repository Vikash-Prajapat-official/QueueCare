import { getLocale, getTranslations } from "next-intl/server";
import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { pageTitle } from "@/i18n/meta";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const generateMetadata = pageTitle("sessions");

export default async function SessionsPage() {
  await requirePageRole(["ADMIN"]);
  const [t, locale] = await Promise.all([getTranslations("admin.sessions"), getLocale()]);
  const deptName = (d: { nameEn: string; nameHi: string }) => (locale === "hi" ? d.nameHi : d.nameEn);
  const dept = { select: { nameEn: true, nameHi: true } };
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`days.${i}`));
  const [sessions, departments, doctors] = await Promise.all([
    db.opdSession.findMany({
      include: { department: dept, doctor: { select: { displayName: true } } },
      orderBy: [{ departmentId: "asc" }, { weekday: "asc" }, { startTime: "asc" }],
    }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
    db.doctor.findMany({ include: { department: dept }, orderBy: { displayName: "asc" } }),
  ]);
  const rows = sessions.map((s) => ({
    id: s.id,
    departmentName: deptName(s.department),
    day: days[s.weekday] ?? String(s.weekday),
    time: t("timeRange", { start: s.startTime, end: s.endTime }),
    doctorName: s.doctor?.displayName ?? null,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    doctorId: s.doctorId,
    maxTokens: s.maxTokens,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <AdminCrud
        noun={t("noun")}
        endpoint="/api/admin/sessions"
        canDelete
        intro={t("intro")}
        rows={rows as Row[]}
        columns={[
          { header: t("department"), key: "departmentName" },
          { header: t("day"), key: "day" },
          { header: t("time"), key: "time" },
          { header: t("doctor"), key: "doctorName" },
          { header: t("maxTokens"), key: "maxTokens" },
        ]}
        fields={[
          {
            name: "departmentId",
            label: t("department"),
            type: "select",
            required: true,
            onEdit: false,
            options: departments.map((d) => ({ value: d.id, label: deptName(d) })),
          },
          {
            name: "doctorId",
            label: t("doctor"),
            type: "select",
            nullable: true,
            options: doctors.map((d) => ({ value: d.id, label: `${d.displayName} (${deptName(d.department)})` })),
            help: t("doctorHelp"),
          },
          {
            name: "weekday",
            label: t("day"),
            type: "select",
            required: true,
            numeric: true,
            options: days.map((d, i) => ({ value: String(i), label: d })),
          },
          { name: "startTime", label: t("start"), type: "time", required: true, defaultValue: "09:00" },
          { name: "endTime", label: t("end"), type: "time", required: true, defaultValue: "13:00" },
          { name: "maxTokens", label: t("maxTokens"), type: "number", nullable: true, help: t("maxTokensHelp") },
        ]}
      />
    </div>
  );
}
