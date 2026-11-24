import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, pickLocale } from "./config";

// No language in the URL: the choice is kept in a cookie, so every link and QR code stays the same.
export default getRequestConfig(async () => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const locale = pickLocale(jar.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Kolkata",
  };
});
