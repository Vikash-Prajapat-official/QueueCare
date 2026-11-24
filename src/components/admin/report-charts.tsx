// Report charts as plain server-rendered SVG and HTML (no chart library, no client JavaScript).
// Colours are the validated categorical palette of the dataviz skill, given to departments in a
// fixed order. Every chart has direct labels or a table next to it, so colour is never the only cue.

import { useLocale, useTranslations } from "next-intl";
import type { DepartmentInfo, Report, Stats } from "@/lib/reports";

const SURFACE = "#fcfcfb";
const MUTED = "#898781";
const GRID = "#e1e0d9";
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export function seriesColor(index: number): string {
  return SERIES[index] ?? MUTED; // a 9th department is grey, never a made-up hue
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 2.5, 5, 10]) if (value <= m * step) return m * step;
  return 10 * step;
}

/** Department name in the reader's language. */
export function deptLabel(d: DepartmentInfo, locale: string): string {
  return locale === "hi" && d.nameHi ? d.nameHi : d.nameEn;
}

export function Legend({ departments }: { departments: DepartmentInfo[] }) {
  const t = useTranslations("admin.reports");
  const locale = useLocale();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t("departments")}>
      {departments.map((d, i) => (
        <li key={d.id} className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: seriesColor(i) }} />
          {d.tokenPrefix} · {deptLabel(d, locale)}
        </li>
      ))}
    </ul>
  );
}

/** Tokens issued per day, stacked by department. */
export function TokensPerDayChart({ report }: { report: Report }) {
  const t = useTranslations("admin.reports");
  const W = 760;
  const H = 280;
  const m = { top: 12, right: 8, bottom: 30, left: 38 };
  const innerW = W - m.left - m.right;
  const innerH = H - m.top - m.bottom;
  const days = report.days;
  const max = niceMax(Math.max(0, ...days.map((d) => d.totals.total)));
  const slot = innerW / days.length;
  const barW = Math.max(2, Math.min(36, slot * 0.7));
  const y = (v: number) => m.top + innerH - (v / max) * innerH;
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

  const summary = t("chartSummary", { from: report.from, to: report.to, total: report.totals.total });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full">
      <title>{summary}</title>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={m.left} x2={W - m.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
          <text x={m.left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={MUTED}>
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        </g>
      ))}

      {days.map((day, i) => {
        const x = m.left + i * slot + (slot - barW) / 2;
        let acc = 0;
        const parts = day.departments.map((s, di) => ({ s, di }));
        const tip =
          t("dayTip", { date: day.date, total: day.totals.total }) +
          parts.filter((p) => p.s.total > 0).map((p) => `, ${report.departments[p.di]?.tokenPrefix} ${p.s.total}`).join("");
        return (
          <g key={day.date}>
            <title>{tip}</title>
            {parts.map(({ s, di }) => {
              if (s.total === 0) return null;
              const top = y(acc + s.total);
              const h = y(acc) - top;
              acc += s.total;
              return (
                <rect
                  key={di}
                  x={x}
                  y={top}
                  width={barW}
                  height={Math.max(h, 1)}
                  rx={2}
                  fill={seriesColor(di)}
                  stroke={SURFACE}
                  strokeWidth={1.5}
                />
              );
            })}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill={MUTED}>
                {day.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={m.left} x2={W - m.right} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />
    </svg>
  );
}

/** Average wait and consult time per department as labelled horizontal bars. */
export function TimesByDepartment({ report }: { report: Report }) {
  const t = useTranslations("admin.reports");
  const locale = useLocale();
  const minutes = (v: number | null) => (v === null ? "—" : t("minutes", { n: v }));
  const rows = report.byDepartment.map((s, i) => ({ s, i, d: report.departments[i] as DepartmentInfo }));
  const longest = Math.max(1, ...rows.flatMap((r) => [r.s.avgWaitMinutes ?? 0, r.s.avgConsultMinutes ?? 0]));

  const Bar = ({ label, value, color }: { label: string; value: number | null; color: string }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 rounded bg-muted">
        {value !== null && <div className="h-3 rounded" style={{ width: `${Math.max(2, (value / longest) * 100)}%`, backgroundColor: color }} />}
      </div>
      <span className="w-20 text-right tabular-nums">{minutes(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {rows.map(({ s, i, d }) => (
        <div key={d.id} className="space-y-1">
          <p className="text-sm font-medium">
            <span className="mr-2 inline-block size-3 rounded-sm align-middle" style={{ backgroundColor: seriesColor(i) }} />
            {d.tokenPrefix} · {deptLabel(d, locale)}
          </p>
          <Bar label={t("wait")} value={s.avgWaitMinutes} color={seriesColor(i)} />
          <Bar label={t("consult")} value={s.avgConsultMinutes} color={seriesColor(i)} />
        </div>
      ))}
    </div>
  );
}

export function StatTable({ rows }: { rows: { label: string; stats: Stats }[] }) {
  const t = useTranslations("admin.reports");
  const minutes = (v: number | null) => (v === null ? "—" : t("minutes", { n: v }));
  const heads = ["tokens", "done", "noShow", "cancelled", "open", "self", "avgWait", "avgConsult"] as const;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <td className="px-3 py-2" />
            {heads.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {t(`col.${h}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, stats: s }) => (
            <tr key={label} className="border-t border-border">
              <th scope="row" className="px-3 py-2 font-medium whitespace-nowrap">
                {label}
              </th>
              <td className="px-3 py-2 tabular-nums">{s.total}</td>
              <td className="px-3 py-2 tabular-nums">{s.done}</td>
              <td className="px-3 py-2 tabular-nums">{s.noShow}</td>
              <td className="px-3 py-2 tabular-nums">{s.cancelled}</td>
              <td className="px-3 py-2 tabular-nums">{s.open}</td>
              <td className="px-3 py-2 tabular-nums">{s.selfCheckIn}</td>
              <td className="px-3 py-2 tabular-nums">{minutes(s.avgWaitMinutes)}</td>
              <td className="px-3 py-2 tabular-nums">{minutes(s.avgConsultMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
