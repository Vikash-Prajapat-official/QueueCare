import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Rooms · QueueCare" };

export default async function RoomsPage() {
  await requirePageRole(["ADMIN"]);
  const [rooms, departments] = await Promise.all([
    db.room.findMany({ include: { department: { select: { nameEn: true } } }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
  ]);
  const rows = rooms.map((r) => ({ id: r.id, name: r.name, departmentId: r.departmentId, departmentName: r.department.nameEn }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rooms</h1>
      <AdminCrud
        noun="room"
        endpoint="/api/admin/rooms"
        intro="The department of a room cannot be changed after it is created."
        rows={rows as Row[]}
        columns={[
          { header: "Room", key: "name" },
          { header: "Department", key: "departmentName" },
        ]}
        fields={[
          { name: "name", label: "Room name", type: "text", required: true },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            required: true,
            onEdit: false,
            options: departments.map((d) => ({ value: d.id, label: d.nameEn })),
          },
        ]}
      />
    </div>
  );
}
