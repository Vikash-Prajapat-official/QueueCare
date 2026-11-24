import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ApiError } from "@/lib/api";
import { getTokenStatusByCode } from "@/lib/queue-service";
import { TokenStatusView } from "./token-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your token · QueueCare",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Public page. The 8-character code in the address is the only secret. No names are shown.
export default async function TokenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  try {
    const initial = await getTokenStatusByCode(upper);
    return <TokenStatusView code={upper} initial={initial} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
