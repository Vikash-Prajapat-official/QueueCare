// Turns an API error into text for the screen. The server answers in English with a stable `code`;
// in Hindi we show our own translation for that code, and fall back to the server's text when we have none.

type Translate = {
  (key: string): string;
  has: (key: string) => boolean;
};

export function apiErrorText(t: Translate, locale: string, body: unknown, fallback: string): string {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const message = typeof error?.message === "string" ? error.message : "";
  const code = typeof error?.code === "string" ? error.code : "";
  // English keeps the server's wording because it can be more specific (for example which field is wrong).
  if (locale === "en") return message || fallback;
  return (code && t.has(code) ? t(code) : message) || fallback;
}
