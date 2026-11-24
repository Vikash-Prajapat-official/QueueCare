"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";

interface Found {
  id: string;
  name: string;
  age: number;
  sex: string;
  createdAt: string;
  visits: number;
}

async function problem(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data?.error?.message ?? "Something went wrong.";
}

export function PrivacyTools() {
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      if (data.items.length === 0) setMessage("No patient found with this phone number.");
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function erase(p: Found) {
    if (!window.confirm(`Erase the name, phone number and ABHA number of ${p.name}? This cannot be undone. Visit counts are kept without a name.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/patients/${p.id}`, { method: "DELETE" });
      if (!res.ok) return setMessage(await problem(res));
      setFound((list) => list?.filter((x) => x.id !== p.id) ?? null);
      setMessage(`The data of ${p.name} was erased.`);
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>A patient&apos;s data request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When a patient asks to see or delete their data: find them by their full phone number, download everything held
          about them, or erase it. Both actions are written to the audit log.
        </p>
        <form onSubmit={find} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>
            Find
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
                  <strong>{p.name}</strong>, {p.age} {p.sex} · {p.visits} {p.visits === 1 ? "visit" : "visits"} · first seen{" "}
                  {p.createdAt.slice(0, 10)}
                </span>
                <a
                  href={`/api/admin/patients/${p.id}/export`}
                  download
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 hover:bg-muted"
                >
                  Download data (JSON)
                </a>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => erase(p)}>
                  Erase data
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
