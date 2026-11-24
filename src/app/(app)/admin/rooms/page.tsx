import { getLocale, getTranslations } from "next-intl/server";
import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { pageTitle } from "@/i18n/meta";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const generateMetadata = pageTitle("rooms");

export default async function RoomsPage() {
  await requirePageRole(["ADMIN"]);
  const [t, locale] = await Promise.all([getTranslations("admin.rooms"), getLocale()]);
  const deptName = (d: { nameEn: string; nameHi: string }) => (locale === "hi" ? d.nameHi : d.nameEn);
  const [rooms, departments] = await Promise.all([
    db.room.findMany({ include: { department: { select: { nameEn: true, nameHi: true } } }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
  ]);
  const rows = rooms.map((r) => ({ id: r.id, name: r.name, departmentId: r.departmentId, departmentName: deptName(r.department) }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <AdminCrud
        noun={t("noun")}
        endpoint="/api/admin/rooms"
        intro={t("intro")}
        rows={rows as Row[]}
        columns={[
          { header: t("room"), key: "name" },
          { header: t("department"), key: "departmentName" },
        ]}
        fields={[
          { name: "name", label: t("roomName"), type: "text", required: true },
          {
            name: "departmentId",
            label: t("department"),
            type: "select",
            required: true,
            onEdit: false,
            options: departments.map((d) => ({ value: d.id, label: deptName(d) })),
          },
        ]}
      />
    </div>
  );
}
