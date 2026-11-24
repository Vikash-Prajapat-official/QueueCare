"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

interface Dept {
  id: string;
  nameEn: string;
  nameHi: string;
}

const SEXES = [
  { value: "M", en: "Male", hi: "पुरुष" },
  { value: "F", en: "Female", hi: "महिला" },
  { value: "O", en: "Other", hi: "अन्य" },
];

export function CheckInForm({ departments, notice }: { departments: Dept[]; notice: { en: string; hi: string } }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!departmentId) return setError("Please choose a department. / कृपया विभाग चुनें।");
    if (!sex) return setError("Please choose male, female or other. / कृपया लिंग चुनें।");
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, age: Number(age), sex, departmentId, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(`/t/${data.code}`);
    } catch {
      setError("Could not reach the hospital server. Please try again or use the desk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="name" className="text-base">
          Name · नाम
        </Label>
        <Input id="name" className="h-12 text-base" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="phone" className="text-base">
          Mobile number · मोबाइल नंबर
        </Label>
        <Input
          id="phone"
          className="h-12 text-base"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="age" className="text-base">
          Age · उम्र
        </Label>
        <Input
          id="age"
          className="h-12 text-base"
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          required
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-base font-medium">Sex · लिंग</legend>
        <div className="grid grid-cols-3 gap-2">
          {SEXES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={sex === s.value}
              onClick={() => setSex(s.value)}
              className={`h-14 rounded-md border text-base ${
                sex === s.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
              }`}
            >
              {s.en}
              <br />
              <span className="text-sm">{s.hi}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-base font-medium">Department · विभाग</legend>
        <div className="grid gap-2">
          {departments.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={departmentId === d.id}
              onClick={() => setDepartmentId(d.id)}
              className={`min-h-14 rounded-md border px-4 py-2 text-left text-base ${
                departmentId === d.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
              }`}
            >
              {d.nameEn} · {d.nameHi}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-md border border-border bg-muted p-3 text-sm">
        <p>
          {notice.en}
        </p>
        <p className="mt-2">
          {notice.hi}
        </p>
      </div>
      <label htmlFor="consent" className="flex items-start gap-3 text-base">
        <input
          id="consent"
          type="checkbox"
          className="mt-1 size-6"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>I agree · मैं सहमत हूँ</span>
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-muted p-3 text-base font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={busy || !consent}>
        {busy ? "Please wait… · कृपया प्रतीक्षा करें…" : "Get token · टोकन पाएँ"}
      </Button>
    </form>
  );
}
