import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { isValidDisplayKey, parseDepartmentIds } from "@/lib/display";
import { getDisplayState } from "@/lib/display-service";
import { DisplayBoard } from "./display-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Now serving · अभी बुलाया जा रहा है",
  robots: { index: false, follow: false },
  // The display key is in the URL, so never pass it on to other sites.
  referrer: "no-referrer",
};

// /display/<departmentId>[,<departmentId>...]?key=<DISPLAY_KEY>  (no login: the TV uses the key)
export default async function DisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ departments: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const [{ departments }, { key }] = await Promise.all([params, searchParams]);
  const ids = parseDepartmentIds(departments);

  if (!ids || !isValidDisplayKey(key)) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-black p-8 text-center text-white">
        <div className="space-y-4 text-3xl">
          <p>This screen needs a valid display link. Ask the hospital admin for it.</p>
          <p lang="hi">इस स्क्रीन के लिए सही डिस्प्ले लिंक चाहिए। अस्पताल के एडमिन से माँगें।</p>
        </div>
      </main>
    );
  }

  const found = await db.department.count({ where: { id: { in: ids } } });
  if (found !== ids.length) notFound();

  const [state, hospital] = await Promise.all([getDisplayState(ids), db.hospital.findFirst({ select: { name: true } })]);
  return (
    <DisplayBoard ids={ids.join(",")} displayKey={key as string} initial={state} hospitalName={hospital?.name ?? "QueueCare"} />
  );
}
