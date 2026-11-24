import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Departments · QueueCare" };

export default async function DepartmentsPage() {
  await requirePageRole(["ADMIN"]);
  const rows = await db.department.findMany({ orderBy: { nameEn: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Departments</h1>
      <AdminCrud
        noun="department"
        endpoint="/api/admin/departments"
        intro="The token prefix (for example MED in MED-034) cannot be changed after the department is created."
        rows={rows as Row[]}
        columns={[
          { header: "Prefix", key: "tokenPrefix" },
          { header: "Name (English)", key: "nameEn" },
          { header: "Name (Hindi)", key: "nameHi" },
          { header: "Colour", key: "color", kind: "color" },
          { header: "Active", key: "active", kind: "bool" },
        ]}
        fields={[
          { name: "nameEn", label: "Name (English)", type: "text", required: true },
          { name: "nameHi", label: "Name (Hindi)", type: "text", required: true },
          { name: "tokenPrefix", label: "Token prefix", type: "text", required: true, onEdit: false, help: "2 to 5 letters, for example MED." },
          { name: "color", label: "Colour", type: "color", defaultValue: "#0f766e" },
          { name: "active", label: "Active", type: "checkbox", onCreate: false },
        ]}
      />
    </div>
  );
}
