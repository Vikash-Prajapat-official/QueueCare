import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Admin · QueueCare" };

export default async function AdminHome() {
  await requirePageRole(["ADMIN"]);
  const [departments, rooms, doctors, sessions, users] = await Promise.all([
    db.department.count(),
    db.room.count(),
    db.doctor.count(),
    db.opdSession.count(),
    db.user.count(),
  ]);
  const sections = [
    { href: "/admin/departments", label: "Departments", count: departments, hint: "Names, token prefix, colour" },
    { href: "/admin/rooms", label: "Rooms", count: rooms, hint: "Consulting rooms per department" },
    { href: "/admin/doctors", label: "Doctors", count: doctors, hint: "Doctor profiles and rooms" },
    { href: "/admin/sessions", label: "OPD sessions", count: sessions, hint: "Weekly timetable" },
    { href: "/admin/users", label: "Users", count: users, hint: "Admins, clerks, doctors, passwords" },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Setup</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
            <Card className="h-full transition-colors hover:bg-muted">
              <CardHeader>
                <CardTitle>{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{s.count}</p>
                <p className="text-sm text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
