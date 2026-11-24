import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api";
import { enforceIp } from "@/lib/public-limits";
import { getTokenStatusByCode } from "@/lib/queue-service";
import { TokenStatusView } from "./token-status";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("titles"))("status"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

// Public page. The 8-character code in the address is the only secret. No names are shown.
export default async function TokenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  try {
    enforceIp(await headers(), "status-page", 60, 60_000, "page requests"); // stops guessing codes
    const initial = await getTokenStatusByCode(upper);
    return <TokenStatusView code={upper} initial={initial} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && e.status === 429) {
      const t = await getTranslations("status");
      return <main className="p-6 text-center text-lg">{t("tooMany")}</main>;
    }
    throw e;
  }
}
