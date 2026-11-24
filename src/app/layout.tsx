import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-devanagari", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: "QueueCare", template: "%s · QueueCare" },
    description: t("description"),
    applicationName: "QueueCare",
    appleWebApp: { capable: true, title: "QueueCare", statusBarStyle: "default" },
    icons: { icon: "/icons/192.png", apple: "/icons/apple-180.png" },
  };
}

export const viewport: Viewport = { themeColor: "#0F766E", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // The landing page text is only used by server components, so it is not sent to the browser.
  const { landing: _landing, ...clientMessages } = (await getMessages()) as Record<string, unknown>;
  void _landing;
  return (
    <html lang={locale} className={`${inter.variable} ${devanagari.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
