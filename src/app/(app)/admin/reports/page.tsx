import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Legend, StatTable, TimesByDepartment, TokensPerDayChart, deptLabel } from "@/components/admin/report-charts";
import { pageTitle } from "@/i18n/meta";
import { requirePageRole } from "@/lib/page-auth";
import { hospitalToday } from "@/lib/queue-service";
import { MAX_EXPORT_DAYS, MAX_REPORT_DAYS, resolveRange } from "@/lib/reports";
import { getReport } from "@/lib/report-service";
import { addDays } from "@/lib/time";

export const generateMetadata = pageTitle("reports");
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePageRole(["ADMIN"]);
  const [tr, locale] = await Promise.all([getTranslations("admin.reports"), getLocale()]);
  const q = await searchParams;
  const today = (await hospitalToday()).toISOString().slice(0, 10);
  const range = resolveRange(q.from, q.to, today, MAX_REPORT_DAYS);

  const quick = [
    { label: tr("today"), from: today, to: today },
    { label: tr("last7"), from: addDays(today, -6), to: today },
    { label: tr("last30"), from: addDays(today, -29), to: today },
  ];

  const report = range.ok ? await getReport(range.from, range.to) : null;
  const busy = report?.departments.filter((_, i) => (report.byDepartment[i]?.total ?? 0) > 0) ?? [];
  const t = report?.totals;
  const csvOk = range.ok && Date.parse(range.to) - Date.parse(range.from) < MAX_EXPORT_DAYS * 86_400_000;
  const minutes = (v: number | null) => (v === null ? "—" : tr("minutes", { n: v }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{tr("title")}</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">{tr("from")}</Label>
          <Input id="from" name="from" type="date" defaultValue={range.ok ? range.from : q.from} />
        </div>
        <div>
          <Label htmlFor="to">{tr("to")}</Label>
          <Input id="to" name="to" type="date" defaultValue={range.ok ? range.to : q.to} />
        </div>
        <Button type="submit">{tr("show")}</Button>
        <span className="flex flex-wrap gap-2 text-sm">
          {quick.map((r) => (
            <Link key={r.from + r.to} href={`/admin/reports?from=${r.from}&to=${r.to}`} className="rounded-md border border-border px-3 py-2 hover:bg-muted">
              {r.label}
            </Link>
          ))}
        </span>
        {range.ok && csvOk && (
          <a
            href={`/api/export/tokens.csv?from=${range.from}&to=${range.to}`}
            className="ml-auto inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {tr("downloadCsv")}
          </a>
        )}
      </form>

      {!range.ok && (
        <p role="alert" className="rounded-md bg-muted p-3 text-sm font-medium text-destructive">
          {tr(`rangeError.${range.reason}`, { max: MAX_REPORT_DAYS })}
        </p>
      )}

      {report && t && (
        <>
          <p className="text-sm text-muted-foreground">
            {report.from === report.to ? report.from : tr("range", { from: report.from, to: report.to })} {tr("explain")}
          </p>

          <section aria-label={tr("summary")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              [tr("tokens"), String(t.total)],
              [tr("done"), String(t.done)],
              [tr("noShows"), String(t.noShow)],
              [tr("avgWait"), minutes(t.avgWaitMinutes)],
              [tr("avgConsult"), minutes(t.avgConsultMinutes)],
              [tr("selfCheckIn"), t.total === 0 ? "—" : `${Math.round((t.selfCheckIn / t.total) * 100)}%`],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {t.total === 0 ? (
            <p className="rounded-md bg-muted p-4 text-center text-muted-foreground">{tr("noTokens")}</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{tr("perDay")}</CardTitle>
                  {busy.length > 1 && <Legend departments={report.departments} />}
                </CardHeader>
                <CardContent>
                  <TokensPerDayChart report={report} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{tr("timesByDept")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimesByDepartment report={report} />
                </CardContent>
              </Card>

              <section className="space-y-2">
                <h2 className="text-lg font-semibold">{tr("byDepartment")}</h2>
                <StatTable
                  rows={[
                    ...report.byDepartment.map((s, i) => {
                      const d = report.departments[i];
                      return { label: d ? `${d.tokenPrefix} · ${deptLabel(d, locale)}` : String(i), stats: s };
                    }),
                    { label: tr("allDepartments"), stats: report.totals },
                  ]}
                />
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-semibold">{tr("byDay")}</h2>
                <StatTable rows={[...report.days].reverse().map((d) => ({ label: d.date, stats: d.totals }))} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
