// Database side of reports and the CSV export. The export contains no patient information at all.

import { db } from "@/lib/db";
import { CSV_BOM, csvRow } from "@/lib/csv";
import { consultMinutes, formatTokenNumber } from "@/lib/queue";
import { buildReport, type Report } from "@/lib/reports";
import { formatLocal } from "@/lib/time";

export async function hospitalTimezone(): Promise<string> {
  const h = await db.hospital.findFirst({ select: { timezone: true } });
  return h?.timezone ?? "Asia/Kolkata";
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export async function getReport(from: string, to: string): Promise<Report> {
  const [departments, tokens] = await Promise.all([
    db.department.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameHi: true, tokenPrefix: true } }),
    db.token.findMany({
      where: { date: { gte: dateOnly(from), lte: dateOnly(to) } },
      select: {
        date: true,
        departmentId: true,
        status: true,
        source: true,
        createdAt: true,
        calledAt: true,
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);
  return buildReport(
    tokens.map((t) => ({ ...t, date: day(t.date) })),
    departments,
    from,
    to,
  );
}

const HEADER = [
  "date",
  "token",
  "department",
  "doctor",
  "visit_type",
  "priority",
  "status",
  "source",
  "created_at",
  "called_at",
  "started_at",
  "completed_at",
  "wait_minutes",
  "consult_minutes",
  "recall_count",
  "skip_count",
];

const PAGE = 500;
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Streams the CSV page by page, so even a year of tokens does not fill the server's memory. */
export function tokensCsvStream(from: string, to: string, timeZone: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor: string | undefined;
  let started = false;
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        controller.enqueue(encoder.encode(CSV_BOM + csvRow(HEADER)));
        return;
      }
      if (finished) {
        controller.close();
        return;
      }
      const rows = await db.token.findMany({
        where: { date: { gte: dateOnly(from), lte: dateOnly(to) } },
        orderBy: [{ date: "asc" }, { departmentId: "asc" }, { seqNo: "asc" }],
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          date: true,
          seqNo: true,
          visitType: true,
          priority: true,
          status: true,
          source: true,
          createdAt: true,
          calledAt: true,
          startedAt: true,
          completedAt: true,
          recallCount: true,
          skipCount: true,
          department: { select: { nameEn: true, tokenPrefix: true } },
          doctor: { select: { displayName: true } },
        },
      });
      const local = (d: Date | null) => formatLocal(d, timeZone);
      let out = "";
      for (const t of rows) {
        const wait = t.calledAt ? (t.calledAt.getTime() - t.createdAt.getTime()) / 60_000 : null;
        out += csvRow([
          day(t.date),
          formatTokenNumber(t.department.tokenPrefix, t.seqNo),
          t.department.nameEn,
          t.doctor?.displayName,
          t.visitType,
          t.priority,
          t.status,
          t.source,
          local(t.createdAt),
          local(t.calledAt),
          local(t.startedAt),
          local(t.completedAt),
          round1(wait),
          round1(consultMinutes(t.startedAt, t.completedAt)),
          t.recallCount,
          t.skipCount,
        ]);
      }
      if (out) controller.enqueue(encoder.encode(out));
      cursor = rows[rows.length - 1]?.id;
      if (rows.length < PAGE) finished = true;
    },
  });
}
