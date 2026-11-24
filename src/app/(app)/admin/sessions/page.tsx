import { AdminCrud, type Row } from "@/components/admin/admin-crud";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "OPD sessions · QueueCare" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SessionsPage() {
  await requirePageRole(["ADMIN"]);
  const [sessions, departments, doctors] = await Promise.all([
    db.opdSession.findMany({
      include: { department: { select: { nameEn: true } }, doctor: { select: { displayName: true } } },
      orderBy: [{ departmentId: "asc" }, { weekday: "asc" }, { startTime: "asc" }],
    }),
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } }),
    db.doctor.findMany({ include: { department: { select: { nameEn: true } } }, orderBy: { displayName: "asc" } }),
  ]);
  const rows = sessions.map((s) => ({
    id: s.id,
    departmentName: s.department.nameEn,
    day: DAYS[s.weekday] ?? String(s.weekday),
    time: `${s.startTime} to ${s.endTime}`,
    doctorName: s.doctor?.displayName ?? null,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    doctorId: s.doctorId,
    maxTokens: s.maxTokens,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">OPD sessions</h1>
      <AdminCrud
        noun="session"
        endpoint="/api/admin/sessions"
        canDelete
        intro="The weekly timetable, for example Medicine, Monday to Saturday, 09:00 to 13:00. Add one session per day."
        rows={rows as Row[]}
        columns={[
          { header: "Department", key: "departmentName" },
          { header: "Day", key: "day" },
          { header: "Time", key: "time" },
          { header: "Doctor", key: "doctorName" },
          { header: "Max tokens", key: "maxTokens" },
        ]}
        fields={[
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            required: true,
            onEdit: false,
            options: departments.map((d) => ({ value: d.id, label: d.nameEn })),
          },
          {
            name: "doctorId",
            label: "Doctor",
            type: "select",
            nullable: true,
            options: doctors.map((d) => ({ value: d.id, label: `${d.displayName} (${d.department.nameEn})` })),
            help: "Optional. Must belong to the same department.",
          },
          {
            name: "weekday",
            label: "Day",
            type: "select",
            required: true,
            numeric: true,
            options: DAYS.map((d, i) => ({ value: String(i), label: d })),
          },
          { name: "startTime", label: "Start", type: "time", required: true, defaultValue: "09:00" },
          { name: "endTime", label: "End", type: "time", required: true, defaultValue: "13:00" },
          { name: "maxTokens", label: "Max tokens", type: "number", nullable: true, help: "Optional daily limit." },
        ]}
      />
    </div>
  );
}
