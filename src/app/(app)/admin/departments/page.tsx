import { getTranslations } from "next-intl/server";
import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { pageTitle } from "@/i18n/meta";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const generateMetadata = pageTitle("departments");

export default async function DepartmentsPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("admin.departments");
  const rows = await db.department.findMany({ orderBy: { nameEn: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <AdminCrud
        noun={t("noun")}
        endpoint="/api/admin/departments"
        intro={t("intro")}
        rows={rows as Row[]}
        columns={[
          { header: t("prefix"), key: "tokenPrefix" },
          { header: t("nameEn"), key: "nameEn" },
          { header: t("nameHi"), key: "nameHi" },
          { header: t("colour"), key: "color", kind: "color" },
          { header: t("active"), key: "active", kind: "bool" },
        ]}
        fields={[
          { name: "nameEn", label: t("nameEn"), type: "text", required: true },
          { name: "nameHi", label: t("nameHi"), type: "text", required: true },
          { name: "tokenPrefix", label: t("tokenPrefix"), type: "text", required: true, onEdit: false, help: t("prefixHelp") },
          { name: "color", label: t("colour"), type: "color", defaultValue: "#0f766e" },
          { name: "active", label: t("active"), type: "checkbox", onCreate: false },
        ]}
      />
    </div>
  );
}
