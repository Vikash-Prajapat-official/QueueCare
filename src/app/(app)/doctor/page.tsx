import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";
import { getQueueSnapshot } from "@/lib/queue-service";
import { DoctorConsole } from "./doctor-console";

export const generateMetadata = pageTitle("doctorConsole");

export default async function DoctorPage() {
  const user = await requirePageRole(["DOCTOR"]);
  const t = await getTranslations("doctor");
  const doctor = await db.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, departmentId: true, displayName: true, room: { select: { name: true } } },
  });

  if (!doctor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("noProfile")}
        </CardContent>
      </Card>
    );
  }

  const snapshot = await getQueueSnapshot(doctor.departmentId, doctor.id);
  return <DoctorConsole snapshot={snapshot} doctorName={doctor.displayName} roomName={doctor.room?.name ?? null} />;
}
