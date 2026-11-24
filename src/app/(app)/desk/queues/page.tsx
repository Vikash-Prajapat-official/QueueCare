import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/meta";
import { requirePageRole } from "@/lib/page-auth";
import { getQueueSnapshot, listDepartments } from "@/lib/queue-service";
import { QueueBoard } from "./queue-board";

export const generateMetadata = pageTitle("queues");

export default async function QueuesPage() {
  await requirePageRole(["ADMIN", "CLERK"]);
  const t = await getTranslations("queues");
  const departments = await listDepartments();
  const snapshots = await Promise.all(departments.map((d) => getQueueSnapshot(d.id, null)));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <QueueBoard snapshots={snapshots} />
    </div>
  );
}
