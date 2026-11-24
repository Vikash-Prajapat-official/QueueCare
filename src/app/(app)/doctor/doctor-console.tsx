"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueueRefresh } from "@/hooks/use-queue-refresh";
import { apiErrorText } from "@/lib/api-error-text";
import type { getQueueSnapshot } from "@/lib/queue-service";

type Snapshot = Awaited<ReturnType<typeof getQueueSnapshot>>;

const BIG = "h-16 text-xl";

export function DoctorConsole({
  snapshot,
  doctorName,
  roomName,
}: {
  snapshot: Snapshot;
  doctorName: string;
  roomName: string | null;
}) {
  const router = useRouter();
  const tr = useTranslations("doctor");
  const tc = useTranslations();
  const te = useTranslations("errors");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useQueueRefresh([snapshot.department.id]);

  const current = snapshot.current[0] ?? null;
  const called = current?.status === "CALLED";
  const inConsult = current?.status === "IN_CONSULT";
  const waitingCount = snapshot.waiting.length;

  async function post(url: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(apiErrorText(te, locale, data, tr("somethingWrong")));
      }
      router.refresh();
    } catch {
      setError(te("NETWORK"));
    } finally {
      setBusy(false);
    }
  }

  const next = () => post(`/api/queue/${snapshot.department.id}/next`);
  const act = (action: string) => current && post(`/api/tokens/${current.id}/${action}`);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{doctorName}</h1>
        <p className="text-sm text-muted-foreground">
          {locale === "hi" ? snapshot.department.nameHi : snapshot.department.nameEn}
          {roomName ? ` · ${roomName}` : ""} · {tr("doneToday", { n: snapshot.counts.done })} · {tr("waitingN", { n: waitingCount })}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-muted p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{current ? (called ? tr("calledWaiting") : tr("inConsultation")) : tr("noCurrent")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {current && (
            <div>
              <p className="text-6xl font-bold text-primary">{current.label}</p>
              <p className="mt-2 text-xl">
                {current.patient.name}, {current.patient.age} {tc(`sex.${current.patient.sex}`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {current.priority !== "NORMAL" && `${tc(`priority.${current.priority}`)} · `}
                {current.visitType === "FOLLOW_UP" ? tr("followUpVisit") : tr("newVisit")}
                {current.recallCount > 0 && ` · ${tr("recalled", { n: current.recallCount })}`}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {called && (
              <>
                <Button className={BIG} onClick={() => act("start")} disabled={busy}>
                  {tr("startConsult")}
                </Button>
                <Button className={BIG} variant="outline" onClick={() => act("recall")} disabled={busy}>
                  {tr("recall")}
                </Button>
                <Button className={BIG} variant="outline" onClick={() => act("skip")} disabled={busy}>
                  {tr("skip")}
                </Button>
                <Button className={BIG} variant="outline" onClick={() => act("no-show")} disabled={busy}>
                  {tr("noShow")}
                </Button>
              </>
            )}
            {inConsult && (
              <Button className={BIG} onClick={() => act("complete")} disabled={busy}>
                {tr("complete")}
              </Button>
            )}
            <Button
              className={BIG}
              variant={current ? "outline" : "default"}
              onClick={next}
              disabled={busy || called || waitingCount === 0}
            >
              {inConsult ? tr("completeNext") : tr("next")}
            </Button>
          </div>
          {called && <p className="text-sm text-muted-foreground">{tr("beforeNext")}</p>}
          {!current && waitingCount === 0 && <p className="text-sm text-muted-foreground">{tr("nobody")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr("waitingTitle", { n: waitingCount })}</CardTitle>
        </CardHeader>
        <CardContent>
          {waitingCount === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("nobody")}</p>
          ) : (
            <ol className="divide-y divide-border">
              {snapshot.waiting.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-6 text-muted-foreground">{t.position}</span>
                  <strong className="w-20 text-lg">{t.label}</strong>
                  <span className="min-w-0 flex-1 text-sm">
                    {t.patient.name}, {t.patient.age} {tc(`sex.${t.patient.sex}`)}
                    {t.priority !== "NORMAL" && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {tc(`priority.${t.priority}`)}
                      </span>
                    )}
                    {t.status === "SKIPPED" && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{tr("skippedEarlier")}</span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">~{tc("common.minutesShort", { n: t.estimatedWaitMinutes })}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
