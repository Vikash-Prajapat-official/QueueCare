import { getTranslations } from "next-intl/server";
import { isDemoMode } from "@/lib/demo";

// Shown only when DEMO_MODE=1 (the public online demo). Renders nothing on a real install.
export async function DemoBanner({ showLogins = false }: { showLogins?: boolean }) {
  if (!isDemoMode()) return null;
  const t = await getTranslations("demo");
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 print:hidden">
      <p className="font-semibold">{t("banner")}</p>
      {showLogins ? <p>{t("logins")}</p> : null}
    </div>
  );
}
