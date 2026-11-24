import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { requirePageRole } from "@/lib/page-auth";
import { listAuditLogs } from "@/lib/audit-log";

export const metadata = { title: "Audit log · QueueCare" };
export const dynamic = "force-dynamic";

const SUGGESTIONS = ["login", "queue.", "create", "update", "delete", "patient.", "export.", "retention.", "checkin", "change-password"];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; action?: string; page?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const q = await searchParams;
  const result = await listAuditLogs({ from: q.from, to: q.to, action: q.action, page: Number(q.page) || 1 });

  const link = (page: number) => {
    const p = new URLSearchParams();
    if (q.from) p.set("from", q.from);
    if (q.to) p.set("to", q.to);
    if (q.action) p.set("action", q.action);
    p.set("page", String(page));
    return `/admin/audit?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-muted-foreground">
        Who did what and when: logins, every queue action, setup changes, exports and privacy requests. It never holds
        patient names or phone numbers. Times are hospital time ({result.timeZone}).
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={q.from} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={q.to} />
        </div>
        <div>
          <Label htmlFor="action">Action starts with</Label>
          <Input id="action" name="action" list="actions" defaultValue={q.action} placeholder="for example queue." />
          <datalist id="actions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <Button type="submit">Filter</Button>
        <Link href="/admin/audit" className="px-2 py-2 text-sm underline">
          Clear
        </Link>
      </form>

      <p className="text-sm">
        {result.total} entries · page {result.page} of {result.pages}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {["Time", "Who", "Action", "Item", "IP"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Nothing found.
                </td>
              </tr>
            )}
            {result.rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.at}</td>
                <td className="px-3 py-2">{r.who}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 text-xs">
                  {r.entity}
                  {r.entityId ? ` ${r.entityId.length > 28 ? `${r.entityId.slice(0, 10)}…` : r.entityId}` : ""}
                </td>
                <td className="px-3 py-2 text-xs">{r.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pages" className="flex gap-3 text-sm">
        {result.page > 1 && (
          <Link href={link(result.page - 1)} className="rounded-md border border-border px-3 py-2 hover:bg-muted">
            ← Newer
          </Link>
        )}
        {result.page < result.pages && (
          <Link href={link(result.page + 1)} className="rounded-md border border-border px-3 py-2 hover:bg-muted">
            Older →
          </Link>
        )}
      </nav>
    </div>
  );
}
