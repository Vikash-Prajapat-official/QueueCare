"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Switches language. The choice is kept for a year in a cookie, then the page is re-read in that language. */
/** tone "dark": on the teal app header. tone "light": on white pages. */
export function LanguageToggle({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const current = useLocale();
  const t = useTranslations("common");
  const router = useRouter();

  function choose(locale: Locale) {
    if (locale === current) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("language")} className={cn("inline-flex overflow-hidden rounded-md border border-current text-sm", className)}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          className={cn("min-h-9 px-3 font-medium", locale === current ? (tone === "light" ? "bg-primary text-primary-foreground" : "bg-white text-primary") : "hover:underline")}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
