import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { pageTitle } from "@/i18n/meta";
import { requirePageRole } from "@/lib/page-auth";
import { listAuditLogs } from "@/lib/audit-log";

export const generateMetadata = pageTitle("audit");
export const dynamic = "force-dynamic";

// Action names are technical codes (they are what is stored), so they are not translated.
const SUGGESTIONS = ["login", "queue.", "create", "update", "delete", "patient.", "export.", "retention.", "checkin", "change-password"];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; action?: string; page?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("admin.audit");
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
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("intro", { tz: result.timeZone })}</p>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">{t("from")}</Label>
          <Input id="from" name="from" type="date" defaultValue={q.from} />
        </div>
        <div>
          <Label htmlFor="to">{t("to")}</Label>
          <Input id="to" name="to" type="date" defaultValue={q.to} />
        </div>
        <div>
          <Label htmlFor="action">{t("actionStarts")}</Label>
          <Input id="action" name="action" list="actions" defaultValue={q.action} placeholder={t("actionExample")} />
          <datalist id="actions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <Button type="submit">{t("filter")}</Button>
        <Link href="/admin/audit" className="px-2 py-2 text-sm underline">
          {t("clear")}
        </Link>
      </form>

      <p className="text-sm">{t("summary", { total: result.total, page: result.page, pages: result.pages })}</p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {(["time", "who", "action", "item", "ip"] as const).map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {t(`col.${h}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t("none")}
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

      <nav aria-label={t("pages")} className="flex gap-3 text-sm">
        {result.page > 1 && (
          <Link href={link(result.page - 1)} className="rounded-md border border-border px-3 py-2 hover:bg-muted">
            {t("newer")}
          </Link>
        )}
        {result.page < result.pages && (
          <Link href={link(result.page + 1)} className="rounded-md border border-border px-3 py-2 hover:bg-muted">
            {t("older")}
          </Link>
        )}
      </nav>
    </div>
  );
}
