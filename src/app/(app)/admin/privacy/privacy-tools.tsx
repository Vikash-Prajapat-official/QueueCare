"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { apiErrorText } from "@/lib/api-error-text";

interface Found {
  id: string;
  name: string;
  age: number;
  sex: string;
  createdAt: string;
  visits: number;
}

export function PrivacyTools() {
  const t = useTranslations("admin.privacy.tools");
  const tc = useTranslations();
  const te = useTranslations("errors");
  const locale = useLocale();
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function problem(res: Response): Promise<string> {
    return apiErrorText(te, locale, await res.json().catch(() => ({})), t("somethingWrong"));
  }

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setFound(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/patients?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return setMessage(await problem(res));
      const data = await res.json();
      setFound(data.items);
      if (data.items.length === 0) setMessage(t("notFound"));
    } catch {
      setMessage(te("NETWORK"));
    } finally {
      setBusy(false);
    }
  }

  async function erase(p: Found) {
    if (!window.confirm(t("confirmErase", { name: p.name }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/patients/${p.id}`, { method: "DELETE" });
      if (!res.ok) return setMessage(await problem(res));
      setFound((list) => list?.filter((x) => x.id !== p.id) ?? null);
      setMessage(t("erased", { name: p.name }));
    } catch {
      setMessage(te("NETWORK"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("help")}</p>
        <form onSubmit={find} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="phone">{tc("common.phone")}</Label>
            <Input id="phone" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>
            {t("find")}
          </Button>
        </form>

        {message && (
          <p role="status" className="rounded-md bg-muted p-3 text-sm">
            {message}
          </p>
        )}

        {found && found.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {found.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{p.name}</strong>, {p.age} {tc(`sex.${p.sex}`)} · {t("visits", { n: p.visits })} · {t("firstSeen", { date: p.createdAt.slice(0, 10) })}
                </span>
                <a
                  href={`/api/admin/patients/${p.id}/export`}
                  download
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 hover:bg-muted"
                >
                  {t("download")}
                </a>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => erase(p)}>
                  {t("erase")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
