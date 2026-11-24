import { requirePageRole } from "@/lib/page-auth";
import { getQueueSnapshot, listDepartments } from "@/lib/queue-service";
import { QueueBoard } from "./queue-board";

export const metadata = { title: "Today's queues · QueueCare" };

export default async function QueuesPage() {
  await requirePageRole(["ADMIN", "CLERK"]);
  const departments = await listDepartments();
  const snapshots = await Promise.all(departments.map((d) => getQueueSnapshot(d.id, null)));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Today&apos;s queues</h1>
      <QueueBoard snapshots={snapshots} />
    </div>
  );
}
