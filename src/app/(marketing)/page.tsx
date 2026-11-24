import Link from "next/link";
import { BarChart3, Clock, Languages, MonitorSpeaker, QrCode, Smartphone, Stethoscope, Ticket, Tv } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/language-toggle";
import { pageTitle } from "@/i18n/meta";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("home");

const SOURCE_A = "https://medicaldialogues.in/news/health/hospital-diagnostics/qr-based-opd-registration-cuts-waiting-time-at-347-hospitals-by-46-minutes-107061";
const SOURCE_B = "https://theprint.in/health/bihars-quiet-digital-revolution-at-govt-hospitals-91-of-patient-registrations-are-now-paperless/2653087";

// Landing page at "/". Server-rendered, no client JavaScript except the language switch.
// Addresses that depend on who hosts this copy come from .env (see .env.example), never from guesses.
export default async function LandingPage() {
  const t = await getTranslations("landing");
  const repo = (process.env.GITHUB_URL ?? "").replace(/\/$/, "");
  const demo = process.env.DEMO_URL || "/login";
  const email = process.env.CONTACT_EMAIL || "contact@example.org";
  const commands = [`git clone ${repo || t("install.repoPlaceholder")} queuecare && cd queuecare`, "cp .env.example .env", "docker compose up -d"];

  const steps = [
    { icon: Ticket, key: "s1" },
    { icon: Smartphone, key: "s2" },
    { icon: Tv, key: "s3" },
  ] as const;
  const features = [
    { icon: Ticket, key: "tokens" },
    { icon: MonitorSpeaker, key: "tv" },
    { icon: Stethoscope, key: "doctor" },
    { icon: QrCode, key: "qr" },
    { icon: Languages, key: "lang" },
    { icon: BarChart3, key: "reports" },
  ] as const;
  const who = ["district", "chc", "nursing", "clinics"] as const;
  const faq = ["q1", "q2", "q3", "q4"] as const;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:p-2">
        {t("skip")}
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-xl font-bold text-primary">QueueCare</span>
          <div className="flex items-center gap-4 text-sm text-primary">
            <LanguageToggle tone="light" className="text-primary" />
            <Link href="/login" className="font-medium underline-offset-4 hover:underline">
              {t("login")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div className="space-y-6">
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{t("hero.title")}</h1>
              <p className="text-lg sm:text-xl">{t("hero.sub")}</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={demo}
                  className="inline-flex h-12 items-center rounded-md bg-white px-6 text-base font-semibold text-primary hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {t("hero.demo")}
                </a>
                <a
                  href="#install"
                  className="inline-flex h-12 items-center rounded-md border-2 border-white px-6 text-base font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {t("hero.install")}
                </a>
              </div>
            </div>

            {/* TV board mock-up: token numbers only, never a name. */}
            <div role="img" aria-label={t("hero.tvLabel")} className="rounded-2xl border-8 border-neutral-800 bg-black p-5 text-white shadow-xl">
              <div className="flex items-center justify-between text-sm text-yellow-300">
                <span className="font-semibold">{t("hero.tvNow")}</span>
                <span className="tabular-nums text-neutral-300">10:42</span>
              </div>
              <div className="mt-3 rounded-xl border-l-8 border-teal-400 bg-neutral-900 p-5 text-center">
                <p className="text-sm text-neutral-300">
                  {t("hero.tvDept")} · {t("hero.tvRoom")}
                </p>
                <p className="mt-1 text-6xl font-extrabold tabular-nums text-yellow-300 sm:text-7xl">MED-034</p>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                {t("hero.tvNext")}
                {["MED-035", "MED-036", "MED-037"].map((n) => (
                  <span key={n} className="rounded bg-neutral-800 px-2 py-1 font-bold tabular-nums text-white">
                    {n}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold">{t("problem.title")}</h2>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">{t("problem.intro")}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {(
              [
                { k: "a", href: SOURCE_A },
                { k: "b", href: SOURCE_B },
              ] as const
            ).map(({ k, href }) => (
              <article key={k} className="rounded-xl border border-border p-6">
                <p className="flex items-baseline gap-3 text-primary" aria-label={`${t(`problem.${k}.from`)} → ${t(`problem.${k}.to`)} ${t(`problem.${k}.unit`)}`}>
                  <span className="text-5xl font-extrabold tabular-nums text-muted-foreground line-through decoration-2">{t(`problem.${k}.from`)}</span>
                  <Clock aria-hidden="true" className="size-6 self-center" />
                  <span className="text-6xl font-extrabold tabular-nums">{t(`problem.${k}.to`)}</span>
                  <span className="text-xl font-semibold">{t(`problem.${k}.unit`)}</span>
                </p>
                <p className="mt-4">{t(`problem.${k}.text`)}</p>
                <p className="mt-3 text-sm">
                  <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
                    {t(`problem.${k}.source`)}
                  </a>
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-muted">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-bold">{t("how.title")}</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {steps.map(({ icon: Icon, key }, i) => (
                <li key={key} className="rounded-xl bg-white p-6 shadow-sm">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">
                    {i + 1}. {t(`how.${key}.t`)}
                  </h3>
                  <p className="mt-2 text-muted-foreground">{t(`how.${key}.d`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold">{t("features.title")}</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, key }) => (
              <li key={key} className="rounded-xl border border-border p-6">
                <Icon aria-hidden="true" className="size-7 text-primary" />
                <h3 className="mt-3 text-lg font-semibold">{t(`features.${key}.t`)}</h3>
                <p className="mt-1 text-muted-foreground">{t(`features.${key}.d`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* For whom */}
        <section className="bg-muted">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-bold">{t("who.title")}</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {who.map((k) => (
                <li key={k} className="rounded-xl bg-white p-5 text-lg font-semibold shadow-sm">
                  {t(`who.${k}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold">{t("privacy.title")}</h2>
          <p className="mt-4 text-2xl font-semibold text-primary">{t("privacy.big")}</p>
          <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{t("privacy.d")}</p>
        </section>

        {/* Install */}
        <section id="install" className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-bold">{t("install.title")}</h2>
            <p className="mt-2 text-lg">{t("install.d")}</p>
            <p className="mt-4 text-sm">{t("install.copyNote")}</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-black p-5 text-sm leading-7 text-green-200 sm:text-base" lang="en">
              <code>{commands.join("\n")}</code>
            </pre>
            <p className="mt-4 text-lg">
              {repo ? (
                <a href={`${repo}/blob/main/ADMIN_GUIDE.md`} className="font-semibold underline underline-offset-4">
                  {t("install.guide")} →
                </a>
              ) : (
                <span className="font-semibold">{t("install.guidePlain")}</span>
              )}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold">{t("faq.title")}</h2>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border">
            {faq.map((k) => (
              <details key={k} className="group p-5">
                <summary className="cursor-pointer text-lg font-semibold marker:text-primary">{t(`faq.${k}.q`)}</summary>
                <p className="mt-3 text-muted-foreground">{t(`faq.${k}.a`)}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
          <p>{t("footer.tag")}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {repo && (
              <li>
                <a href={repo} className="text-primary underline underline-offset-2">
                  {t("footer.github")}
                </a>
              </li>
            )}
            <li>{t("footer.licence")}</li>
            <li>
              {t("footer.contact")}:{" "}
              <a href={`mailto:${email}`} className="text-primary underline underline-offset-2">
                {email}
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </>
  );
}
