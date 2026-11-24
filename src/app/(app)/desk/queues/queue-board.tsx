"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { useQueueRefresh } from "@/hooks/use-queue-refresh";
import { apiErrorText } from "@/lib/api-error-text";
import type { getQueueSnapshot } from "@/lib/queue-service";

type Snapshot = Awaited<ReturnType<typeof getQueueSnapshot>>;

export function QueueBoard({ snapshots }: { snapshots: Snapshot[] }) {
  const router = useRouter();
  const tr = useTranslations("queues");
  const tc = useTranslations();
  const te = useTranslations("errors");
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useQueueRefresh(snapshots.map((s) => s.department.id));

  async function act(tokenId: string, action: "transfer" | "cancel", body?: unknown) {
    setBusy(tokenId);
    setError(null);
    try {
      const res = await fetch(`/api/tokens/${tokenId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(apiErrorText(te, locale, data, tr("somethingWrong")));
      }
      router.refresh();
    } catch {
      setError(te("NETWORK"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {snapshots.length === 0 && <p className="text-muted-foreground">{tr("noDepartments")}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {snapshots.map((s) => (
          <Card key={s.department.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full" style={{ backgroundColor: s.department.color }} />
                {locale === "hi" ? s.department.nameHi : s.department.nameEn} ({s.department.tokenPrefix})
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {tr("counts", {
                  waiting: s.counts.waiting + s.counts.skipped,
                  withDoctor: s.counts.called + s.counts.inConsult,
                  done: s.counts.done,
                  noShow: s.counts.noShow,
                  cancelled: s.counts.cancelled,
                  total: s.counts.total,
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.current.map((t) => (
                <p key={t.id} className="rounded-md bg-muted p-2 text-sm">
                  <strong>{t.label}</strong> {tc(`status.${t.status}`)} · {t.patient.name}
                  {t.doctorName ? ` · ${t.doctorName}` : ""}
                </p>
              ))}

              {s.waiting.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tr("nobody")}</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {s.waiting.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="w-6 text-muted-foreground">{t.position}</span>
                      <strong className="w-20">{t.label}</strong>
                      <span className="min-w-0 flex-1">
                        {t.patient.name}, {t.patient.age} {tc(`sex.${t.patient.sex}`)}
                        {t.priority !== "NORMAL" && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                            {tc(`priority.${t.priority}`)}
                          </span>
                        )}
                        {t.status === "SKIPPED" && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{tc("status.SKIPPED")}</span>
                        )}
                      </span>
                      <Select
                        aria-label={tr("doctorFor", { label: t.label })}
                        className="h-8 w-40 text-xs"
                        value={t.doctorId ?? ""}
                        disabled={busy === t.id || t.status !== "WAITING"}
                        onChange={(e) => act(t.id, "transfer", { doctorId: e.target.value || null })}
                      >
                        <option value="">{tr("anyDoctor")}</option>
                        {s.doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.displayName}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy === t.id}
                        onClick={() => {
                          if (window.confirm(tr("confirmCancel", { label: t.label }))) act(t.id, "cancel");
                        }}
                      >
                        {tr("cancel")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
