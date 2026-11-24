import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Installable app (PWA). The worker (src/sw.ts) keeps only the app's own scripts, styles and fonts,
// plus an "offline" page. It never stores pages, queue data or API answers (see DECISIONS.md).
const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/offline", revision: randomUUID() }],
  // Serve the worker's own file fresh so a new version is picked up after an update.
  cacheOnNavigation: false,
  reloadOnOnline: false,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Put title and description in <head> for every visitor (Next streams them into <body> otherwise,
  // which search engines and Lighthouse do not read).
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
