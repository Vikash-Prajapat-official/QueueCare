import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";
import { getQueueSnapshot } from "@/lib/queue-service";
import { DoctorConsole } from "./doctor-console";

export const metadata = { title: "Doctor console · QueueCare" };

export default async function DoctorPage() {
  const user = await requirePageRole(["DOCTOR"]);
  const doctor = await db.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, departmentId: true, displayName: true, room: { select: { name: true } } },
  });

  if (!doctor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Doctor console</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your doctor profile is not set up yet. Ask the admin to add it under Admin, Doctors.
        </CardContent>
      </Card>
    );
  }

  const snapshot = await getQueueSnapshot(doctor.departmentId, doctor.id);
  return <DoctorConsole snapshot={snapshot} doctorName={doctor.displayName} roomName={doctor.room?.name ?? null} />;
}
