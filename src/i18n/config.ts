// Languages the app speaks. To add one: add its code here, add messages/<code>.json
// (copy en.json and translate) and a name in LOCALE_NAMES. The tests check every file has the same keys.
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Each language is written in its own script so a patient can find theirs.
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिन्दी" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Picks a language from the saved choice, else from the browser's Accept-Language, else English. */
export function pickLocale(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/** Locale tag for number and date formatting. */
export function formatTag(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}
