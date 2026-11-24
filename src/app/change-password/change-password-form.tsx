"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { apiErrorText } from "@/lib/api-error-text";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations("changePassword");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(t("mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(apiErrorText(te, locale, data, t("failed")));
        return;
      }
      // The session still says "must change password", so log in again with the new one.
      await signOut({ redirectTo: "/login?changed=1" });
    } catch {
      setError(te("NETWORK"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {forced && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          {t("forced")}
        </p>
      )}
      <div>
        <Label htmlFor="current">{t("current")}</Label>
        <Input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="next">{t("new")}</Label>
        <Input id="next" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <div>
        <Label htmlFor="confirm">{t("repeat")}</Label>
        <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
