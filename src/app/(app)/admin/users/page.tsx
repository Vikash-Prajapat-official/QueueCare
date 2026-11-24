import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Users · QueueCare" };

export default async function UsersPage() {
  await requirePageRole(["ADMIN"]);
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
        department: { select: { nameEn: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
  ]);
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    departmentId: u.departmentId,
    departmentName: u.department?.nameEn ?? null,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <AdminCrud
        noun="user"
        endpoint="/api/admin/users"
        intro="An admin-set password is temporary: the person must choose their own when they first log in. You cannot change your own role or deactivate yourself."
        rows={rows as Row[]}
        columns={[
          { header: "Name", key: "name" },
          { header: "Phone", key: "phone" },
          { header: "Role", key: "role" },
          { header: "Department", key: "departmentName" },
          { header: "Active", key: "active", kind: "bool" },
          { header: "Must change password", key: "mustChangePassword", kind: "bool" },
        ]}
        fields={[
          { name: "name", label: "Full name", type: "text", required: true },
          { name: "phone", label: "Phone number (login)", type: "text", required: true, help: "10-digit mobile number." },
          {
            name: "password",
            label: "Password",
            type: "password",
            required: "create",
            help: "At least 8 characters. When editing, leave blank to keep the current password.",
          },
          {
            name: "role",
            label: "Role",
            type: "select",
            required: true,
            options: [
              { value: "ADMIN", label: "Admin" },
              { value: "CLERK", label: "Clerk (registration desk)" },
              { value: "DOCTOR", label: "Doctor" },
            ],
          },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            nullable: true,
            options: departments.map((d) => ({ value: d.id, label: d.nameEn })),
            help: "Optional. Doctors get theirs from the Doctors screen.",
          },
          { name: "active", label: "Active", type: "checkbox", onCreate: false },
        ]}
      />
    </div>
  );
}
