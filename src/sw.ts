/// <reference lib="webworker" />
// Service worker for the installable app. Deliberately small:
//  - keeps the app's own scripts, styles, fonts and icons so the app opens fast, and
//  - shows a friendly "offline" page when there is no network.
// It never stores pages, patient data or API answers: queue screens must always be live.
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// Only the offline page is kept from the build's file list; static files are cached as they are used.
const offlineOnly = (self.__SW_MANIFEST ?? []).filter((e) => (typeof e === "string" ? e : e.url) === "/offline");

const serwist: Serwist = new Serwist({
  precacheEntries: offlineOnly,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Pages always come live from the server. Only when that fails (no network) is the offline page shown.
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly({
        plugins: [{ handlerDidError: async (): Promise<Response> => (await serwist.matchPrecache("/offline")) ?? Response.error() }],
      }),
    },
    {
      // Files with a fingerprint in the name never change, so they can be kept for good.
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "qc-static",
        plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 90 })],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/icons/"),
      handler: new CacheFirst({
        cacheName: "qc-icons",
        plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
  ],
});

serwist.addEventListeners();
