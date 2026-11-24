import { getTranslations } from "next-intl/server";

/** For a page: `export const generateMetadata = pageTitle("newToken");` (text from "titles.<key>"). */
export function pageTitle(key: string) {
  return async () => ({ title: (await getTranslations("titles"))(key) });
}
