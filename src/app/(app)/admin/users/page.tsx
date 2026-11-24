import { getLocale, getTranslations } from "next-intl/server";
import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { pageTitle } from "@/i18n/meta";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const generateMetadata = pageTitle("users");

export default async function UsersPage() {
  await requirePageRole(["ADMIN"]);
  const [t, locale] = await Promise.all([getTranslations("admin.users"), getLocale()]);
  const deptName = (d: { nameEn: string; nameHi: string }) => (locale === "hi" ? d.nameHi : d.nameEn);
  const [users, departments] = await Promise.all([
    // passwordHash is never selected
    db.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        departmentId: true,
        active: true,
        mustChangePassword: true,
        department: { select: { nameEn: true, nameHi: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
  ]);
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: t(`role.${u.role}`),
    departmentId: u.departmentId,
    departmentName: u.department ? deptName(u.department) : null,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <AdminCrud
        noun={t("noun")}
        endpoint="/api/admin/users"
        intro={t("intro")}
        rows={rows as Row[]}
        columns={[
          { header: t("name"), key: "name" },
          { header: t("phone"), key: "phone" },
          { header: t("roleLabel"), key: "role" },
          { header: t("department"), key: "departmentName" },
          { header: t("active"), key: "active", kind: "bool" },
          { header: t("mustChange"), key: "mustChangePassword", kind: "bool" },
        ]}
        fields={[
          { name: "name", label: t("fullName"), type: "text", required: true },
          { name: "phone", label: t("phoneLogin"), type: "text", required: true, help: t("phoneHelp") },
          {
            name: "password",
            label: t("password"),
            type: "password",
            required: "create",
            help: t("passwordHelp"),
          },
          {
            name: "role",
            label: t("roleLabel"),
            type: "select",
            required: true,
            options: [
              { value: "ADMIN", label: t("role.ADMIN") },
              { value: "CLERK", label: t("role.CLERK") },
              { value: "DOCTOR", label: t("role.DOCTOR") },
            ],
          },
          {
            name: "departmentId",
            label: t("department"),
            type: "select",
            nullable: true,
            options: departments.map((d) => ({ value: d.id, label: deptName(d) })),
            help: t("departmentHelp"),
          },
          { name: "active", label: t("active"), type: "checkbox", onCreate: false },
        ]}
      />
    </div>
  );
}
