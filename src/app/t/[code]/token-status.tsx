"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageToggle } from "@/components/language-toggle";
import { formatTag, type Locale } from "@/i18n/config";
import type { getTokenStatusByCode } from "@/lib/queue-service";

type Status = Awaited<ReturnType<typeof getTokenStatusByCode>>;

const POLL_MS = 5000;

type Translate = ReturnType<typeof useTranslations<"status">>;

function describe(s: Status, t: Translate): { title: string; detail: string; tone: "go" | "info" | "end" } {
  if (!s.isToday && s.status !== "DONE") {
    return { title: t("oldTitle"), detail: t("oldDetail"), tone: "end" };
  }
  switch (s.status) {
    case "CALLED":
      return {
        title: t("calledTitle"),
        detail: s.roomName ? t("calledRoom", { room: s.roomName }) : t("calledDoctor"),
        tone: "go",
      };
    case "IN_CONSULT":
      return { title: t("consultTitle"), detail: t("consultDetail"), tone: "info" };
    case "SKIPPED":
      return { title: t("skippedTitle"), detail: t("skippedDetail", { n: s.peopleAhead }), tone: "info" };
    case "WAITING":
      return {
        title: s.peopleAhead === 0 ? t("nextTitle") : t("waitTitle"),
        detail:
          s.peopleAhead === 0
            ? t("nextDetail")
            : t("waitDetail", { n: s.peopleAhead, minutes: s.estimatedWaitMinutes }),
        tone: "info",
      };
    case "DONE":
      return { title: t("doneTitle"), detail: t("doneDetail"), tone: "end" };
    case "NO_SHOW":
      return { title: t("noShowTitle"), detail: t("deskDetail"), tone: "end" };
    case "CANCELLED":
      return { title: t("cancelledTitle"), detail: t("deskDetail"), tone: "end" };
  }
}

export function TokenStatusView({ code, initial }: { code: string; initial: Status }) {
  const t = useTranslations("status");
  const locale = useLocale() as Locale;
  const [status, setStatus] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [updated, setUpdated] = useState("");
  const wasCalled = useRef(initial.yourTurn);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${code}/status`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next: Status = await res.json();
      setStatus(next);
      setOffline(false);
      setUpdated(new Date().toLocaleTimeString(formatTag(locale), { hour: "2-digit", minute: "2-digit" }));
      if (next.yourTurn && !wasCalled.current) navigator.vibrate?.([300, 150, 300]);
      wasCalled.current = next.yourTurn;
    } catch {
      setOffline(true);
    }
  }, [code, locale]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const info = describe(status, t);
  const tone =
    info.tone === "go" ? "bg-green-700 text-white" : info.tone === "end" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <div className="flex justify-end text-primary">
        <LanguageToggle tone="light" />
      </div>
      <header className="text-center">
        <p className="text-sm text-muted-foreground">{t("yourToken")}</p>
        <p className="text-6xl font-extrabold tracking-tight text-primary" aria-label={t("tokenAria", { label: status.label })}>
          {status.label}
        </p>
        <p className="text-lg">{locale === "hi" ? status.department.nameHi : status.department.nameEn}</p>
        {(status.doctorName || status.roomName) && (
          <p className="text-muted-foreground">{[status.doctorName, status.roomName].filter(Boolean).join(" · ")}</p>
        )}
      </header>

      <section aria-live="polite" className={`rounded-xl p-6 text-center ${tone}`}>
        <h1 className="text-2xl font-bold">{info.title}</h1>
        <p className="mt-2 text-lg">{info.detail}</p>
      </section>

      {status.position !== null && status.isToday && (
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-sm text-muted-foreground">{t("place")}</dt>
            <dd className="text-3xl font-bold">{status.position}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-sm text-muted-foreground">{t("waitingTime")}</dt>
            <dd className="text-3xl font-bold">{t("minutes", { n: status.estimatedWaitMinutes })}</dd>
          </div>
        </dl>
      )}

      <p className="text-center text-xs text-muted-foreground" role="status">
        {offline ? t("offline") : updated ? t("updated", { time: updated }) : t("updatesByItself")}
      </p>
    </main>
  );
}
