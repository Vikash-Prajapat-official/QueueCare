"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueueRefresh } from "@/hooks/use-queue-refresh";
import { PRIORITY_LABELS } from "@/lib/queue-labels";
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
        setError(data?.error?.message ?? "Something went wrong.");
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
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
          {snapshot.department.nameEn}
          {roomName ? ` · ${roomName}` : ""} · {snapshot.counts.done} done today · {waitingCount} waiting
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-muted p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{current ? (called ? "Called, waiting for the patient" : "In consultation") : "No current patient"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {current && (
            <div>
              <p className="text-6xl font-bold text-primary">{current.label}</p>
              <p className="mt-2 text-xl">
                {current.patient.name}, {current.patient.age} {current.patient.sex}
              </p>
              <p className="text-sm text-muted-foreground">
                {current.priority !== "NORMAL" && `${PRIORITY_LABELS[current.priority]} · `}
                {current.visitType === "FOLLOW_UP" ? "Follow-up" : "New visit"}
                {current.recallCount > 0 && ` · recalled ${current.recallCount}×`}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {called && (
              <>
                <Button className={BIG} onClick={() => act("start")} disabled={busy}>
                  Start consult
                </Button>
                <Button className={BIG} variant="outline" onClick={() => act("recall")} disabled={busy}>
                  Recall
                </Button>
                <Button className={BIG} variant="outline" onClick={() => act("skip")} disabled={busy}>
                  Skip
                </Button>
                <Button className={BIG} variant="outline" onClick={() => act("no-show")} disabled={busy}>
                  No-show
                </Button>
              </>
            )}
            {inConsult && (
              <Button className={BIG} onClick={() => act("complete")} disabled={busy}>
                Complete
              </Button>
            )}
            <Button
              className={BIG}
              variant={current ? "outline" : "default"}
              onClick={next}
              disabled={busy || called || waitingCount === 0}
            >
              {inConsult ? "Complete and call next" : "Next"}
            </Button>
          </div>
          {called && <p className="text-sm text-muted-foreground">Start, skip or mark no-show before calling the next patient.</p>}
          {!current && waitingCount === 0 && <p className="text-sm text-muted-foreground">Nobody is waiting.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waiting ({waitingCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {waitingCount === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is waiting.</p>
          ) : (
            <ol className="divide-y divide-border">
              {snapshot.waiting.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-6 text-muted-foreground">{t.position}</span>
                  <strong className="w-20 text-lg">{t.label}</strong>
                  <span className="min-w-0 flex-1 text-sm">
                    {t.patient.name}, {t.patient.age} {t.patient.sex}
                    {t.priority !== "NORMAL" && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    )}
                    {t.status === "SKIPPED" && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">Skipped earlier</span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">~{t.estimatedWaitMinutes} min</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
