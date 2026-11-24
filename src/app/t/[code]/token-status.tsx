"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { getTokenStatusByCode } from "@/lib/queue-service";

type Status = Awaited<ReturnType<typeof getTokenStatusByCode>>;

const POLL_MS = 5000;

function describe(s: Status): { title: string; detail: string; tone: "go" | "info" | "end" } {
  if (!s.isToday && s.status !== "DONE") {
    return { title: "This token is from an earlier day", detail: "Please get a new token at the registration desk.", tone: "end" };
  }
  switch (s.status) {
    case "CALLED":
      return {
        title: "It is your turn!",
        detail: `Please go to ${s.roomName ?? "the doctor"} now.`,
        tone: "go",
      };
    case "IN_CONSULT":
      return { title: "You are with the doctor", detail: "Thank you for waiting.", tone: "info" };
    case "SKIPPED":
      return {
        title: "You were skipped for now",
        detail: `Please stay nearby. About ${s.peopleAhead} patients will be called before you.`,
        tone: "info",
      };
    case "WAITING":
      return {
        title: s.peopleAhead === 0 ? "You are next" : "Please wait",
        detail:
          s.peopleAhead === 0
            ? "Stay close to the doctor's room."
            : `${s.peopleAhead} ${s.peopleAhead === 1 ? "patient is" : "patients are"} ahead of you. About ${s.estimatedWaitMinutes} minutes.`,
        tone: "info",
      };
    case "DONE":
      return { title: "Your visit is complete", detail: "Thank you. Get well soon.", tone: "end" };
    case "NO_SHOW":
      return { title: "You were not here when called", detail: "Please meet the registration desk.", tone: "end" };
    case "CANCELLED":
      return { title: "This token was cancelled", detail: "Please meet the registration desk.", tone: "end" };
  }
}

export function TokenStatusView({ code, initial }: { code: string; initial: Status }) {
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
      setUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      if (next.yourTurn && !wasCalled.current) navigator.vibrate?.([300, 150, 300]);
      wasCalled.current = next.yourTurn;
    } catch {
      setOffline(true);
    }
  }, [code]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const info = describe(status);
  const tone =
    info.tone === "go" ? "bg-green-600 text-white" : info.tone === "end" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="pt-2 text-center">
        <p className="text-sm text-muted-foreground">Your token</p>
        <p className="text-6xl font-extrabold tracking-tight text-primary" aria-label={`Token ${status.label}`}>
          {status.label}
        </p>
        <p className="text-lg">
          {status.department.nameEn} · {status.department.nameHi}
        </p>
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
            <dt className="text-sm text-muted-foreground">Your place</dt>
            <dd className="text-3xl font-bold">{status.position}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-sm text-muted-foreground">Waiting time</dt>
            <dd className="text-3xl font-bold">{status.estimatedWaitMinutes} min</dd>
          </div>
        </dl>
      )}

      <p className="text-center text-xs text-muted-foreground" role="status">
        {offline ? "No connection. Trying again…" : updated ? `Updated ${updated}. This page updates by itself.` : "This page updates by itself."}
      </p>
    </main>
  );
}
