import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Legend, StatTable, TimesByDepartment, TokensPerDayChart } from "@/components/admin/report-charts";
import { requirePageRole } from "@/lib/page-auth";
import { hospitalToday } from "@/lib/queue-service";
import { MAX_EXPORT_DAYS, MAX_REPORT_DAYS, resolveRange } from "@/lib/reports";
import { getReport } from "@/lib/report-service";
import { addDays } from "@/lib/time";

export const metadata = { title: "Reports · QueueCare" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePageRole(["ADMIN"]);
  const q = await searchParams;
  const today = (await hospitalToday()).toISOString().slice(0, 10);
  const range = resolveRange(q.from, q.to, today, MAX_REPORT_DAYS);

  const quick = [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
  ];

  const report = range.ok ? await getReport(range.from, range.to) : null;
  const busy = report?.departments.filter((_, i) => (report.byDepartment[i]?.total ?? 0) > 0) ?? [];
  const t = report?.totals;
  const csvOk = range.ok && Date.parse(range.to) - Date.parse(range.from) < MAX_EXPORT_DAYS * 86_400_000;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={range.ok ? range.from : q.from} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={range.ok ? range.to : q.to} />
        </div>
        <Button type="submit">Show</Button>
        <span className="flex flex-wrap gap-2 text-sm">
          {quick.map((r) => (
            <Link key={r.label} href={`/admin/reports?from=${r.from}&to=${r.to}`} className="rounded-md border border-border px-3 py-2 hover:bg-muted">
              {r.label}
            </Link>
          ))}
        </span>
        {range.ok && csvOk && (
          <a
            href={`/api/export/tokens.csv?from=${range.from}&to=${range.to}`}
            className="ml-auto inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Download CSV
          </a>
        )}
      </form>

      {!range.ok && (
        <p role="alert" className="rounded-md bg-muted p-3 text-sm font-medium text-destructive">
          {range.message}
        </p>
      )}

      {report && t && (
        <>
          <p className="text-sm text-muted-foreground">
            {report.from === report.to ? report.from : `${report.from} to ${report.to}`}. Wait is the time from getting a
            token to being called first; consult is from Start to Complete (consults over 3 hours are ignored). The CSV has
            one row per token and no patient names or phone numbers.
          </p>

          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Tokens", String(t.total)],
              ["Done", String(t.done)],
              ["No-shows", String(t.noShow)],
              ["Average wait", t.avgWaitMinutes === null ? "—" : `${t.avgWaitMinutes} min`],
              ["Average consult", t.avgConsultMinutes === null ? "—" : `${t.avgConsultMinutes} min`],
              ["Self check-in", t.total === 0 ? "—" : `${Math.round((t.selfCheckIn / t.total) * 100)}%`],
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
            <p className="rounded-md bg-muted p-4 text-center text-muted-foreground">No tokens in this period.</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Tokens per day</CardTitle>
                  {busy.length > 1 && <Legend departments={report.departments} />}
                </CardHeader>
                <CardContent>
                  <TokensPerDayChart report={report} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average time by department</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimesByDepartment report={report} />
                </CardContent>
              </Card>

              <section className="space-y-2">
                <h2 className="text-lg font-semibold">By department</h2>
                <StatTable
                  rows={[
                    ...report.byDepartment.map((s, i) => ({
                      label: `${report.departments[i]?.tokenPrefix} · ${report.departments[i]?.nameEn}`,
                      stats: s,
                    })),
                    { label: "All departments", stats: report.totals },
                  ]}
                />
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-semibold">By day</h2>
                <StatTable rows={[...report.days].reverse().map((d) => ({ label: d.date, stats: d.totals }))} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
