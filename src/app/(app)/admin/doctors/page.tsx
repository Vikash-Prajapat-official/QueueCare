import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Doctors · QueueCare" };

export default async function DoctorsPage() {
  await requirePageRole(["ADMIN"]);
  const [doctors, freeUsers, departments, rooms] = await Promise.all([
    db.doctor.findMany({
      include: {
        user: { select: { name: true, phone: true } },
        department: { select: { nameEn: true } },
        room: { select: { name: true } },
      },
      orderBy: { displayName: "asc" },
    }),
    // Doctor-role users who do not have a doctor profile yet
    db.user.findMany({ where: { role: "DOCTOR", active: true, doctor: null }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
    db.room.findMany({ include: { department: { select: { nameEn: true } } }, orderBy: { name: "asc" } }),
  ]);
  const rows = doctors.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    roomId: d.roomId,
    login: `${d.user.name} (${d.user.phone})`,
    departmentName: d.department.nameEn,
    roomName: d.room?.name ?? null,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Doctors</h1>
      <AdminCrud
        noun="doctor"
        endpoint="/api/admin/doctors"
        intro="First add a user with the Doctor role under Users, then create the doctor profile here. The login and department cannot be changed afterwards."
        rows={rows as Row[]}
        columns={[
          { header: "Display name", key: "displayName" },
          { header: "Login", key: "login" },
          { header: "Department", key: "departmentName" },
          { header: "Room", key: "roomName" },
        ]}
        fields={[
          {
            name: "userId",
            label: "Doctor login",
            type: "select",
            required: true,
            onEdit: false,
            options: freeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.phone})` })),
            help: freeUsers.length === 0 ? "No doctor-role users without a profile. Add one under Users." : undefined,
          },
          { name: "displayName", label: "Display name", type: "text", required: true, help: "Shown to patients, for example Dr. Anil Sharma." },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            required: true,
            onEdit: false,
            options: departments.map((d) => ({ value: d.id, label: d.nameEn })),
          },
          {
            name: "roomId",
            label: "Room",
            type: "select",
            nullable: true,
            options: rooms.map((r) => ({ value: r.id, label: `${r.department.nameEn} · ${r.name}` })),
            help: "Must be a room of the doctor's department.",
          },
        ]}
      />
    </div>
  );
}
