"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { PRIORITY_OPTIONS } from "@/lib/queue-labels";

interface Dept {
  id: string;
  nameEn: string;
  nameHi: string;
  tokenPrefix: string;
  doctors: { id: string; displayName: string; roomName: string | null }[];
}
interface Match {
  id: string;
  name: string;
  age: number;
  sex: string;
  abhaNumber: string | null;
}
interface Created {
  id: string;
  code: string;
  label: string;
  date: string;
  department: { nameEn: string; nameHi: string };
  doctorName: string | null;
  roomName: string | null;
  peopleAhead: number;
  estimatedWaitMinutes: number;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data?.error?.message ?? "Something went wrong.";
}

export function NewTokenForm({
  departments,
  hospitalName,
  appUrl,
  notice,
}: {
  departments: Dept[];
  hospitalName: string;
  appUrl: string;
  notice: { en: string; hi: string };
}) {
  const [phone, setPhone] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [abha, setAbha] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [visitType, setVisitType] = useState("NEW");
  const [priority, setPriority] = useState("NORMAL");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const department = departments.find((d) => d.id === departmentId);

  function reset() {
    setPhone("");
    setMatches([]);
    setSearchMsg(null);
    setPatientId(null);
    setName("");
    setAge("");
    setSex("");
    setAbha("");
    setDoctorId("");
    setVisitType("NEW");
    setPriority("NORMAL");
    setConsent(false);
    setError(null);
    setCreated(null);
  }

  async function search() {
    setSearchMsg(null);
    setMatches([]);
    const res = await fetch(`/api/patients/search?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) {
      setSearchMsg(await readError(res));
      return;
    }
    const data = await res.json();
    setMatches(data.items);
    if (data.items.length === 0) setSearchMsg("No earlier visit found. Fill in the details below.");
  }

  function selectMatch(m: Match) {
    setPatientId(m.id);
    setName(m.name);
    setAge(String(m.age));
    setSex(m.sex);
    setAbha(m.abhaNumber ?? "");
    setVisitType("FOLLOW_UP");
    setMatches([]);
    setSearchMsg(null);
    if (m.age >= 60) setPriority((p) => (p === "NORMAL" ? "ELDERLY" : p));
  }

  function changeAge(value: string) {
    setAge(value);
    // Suggest the elderly queue; the clerk can still change it.
    if (Number(value) >= 60) setPriority((p) => (p === "NORMAL" ? "ELDERLY" : p));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          departmentId,
          doctorId: doctorId || null,
          visitType,
          priority,
          consent,
          ...(patientId
            ? { patientId }
            : { patient: { name, phone, age: Number(age), sex, abhaNumber: abha.trim() || null } }),
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setCreated((await res.json()).token);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return <TokenResult token={created} hospitalName={hospitalName} appUrl={appUrl} onNew={reset} />;
  }

  const locked = patientId !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New token</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="phone">Patient phone number</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                disabled={locked}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
              <Button type="button" variant="outline" onClick={search} disabled={locked || phone.trim() === ""}>
                Find earlier visit
              </Button>
            </div>
            {searchMsg && <p className="mt-1 text-sm text-muted-foreground">{searchMsg}</p>}
            {matches.length > 0 && (
              <ul className="mt-2 space-y-2" aria-label="Patients found">
                {matches.map((m) => (
                  <li key={m.id}>
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => selectMatch(m)}>
                      Use {m.name}, {m.age} {m.sex}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {locked && (
              <p className="mt-1 text-sm">
                Returning patient selected.{" "}
                <button type="button" className="underline" onClick={() => setPatientId(null)}>
                  Not this patient
                </button>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={0}
                max={120}
                required
                value={age}
                disabled={locked}
                onChange={(e) => changeAge(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sex">Sex</Label>
              <Select id="sex" required value={sex} disabled={locked} onChange={(e) => setSex(e.target.value)}>
                <option value="">Choose…</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="abha">ABHA number (optional)</Label>
            <Input id="abha" value={abha} disabled={locked} onChange={(e) => setAbha(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <Label htmlFor="visit">Visit</Label>
            <Select id="visit" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              <option value="NEW">New</option>
              <option value="FOLLOW_UP">Follow-up</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="dept">Department</Label>
            <Select
              id="dept"
              required
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setDoctorId("");
              }}
            >
              <option value="">Choose…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameEn} ({d.tokenPrefix})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="doctor">Doctor</Label>
            <Select id="doctor" value={doctorId} disabled={!department} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Any doctor</option>
              {department?.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                  {d.roomName ? ` (${d.roomName})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <label htmlFor="consent" className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              id="consent"
              type="checkbox"
              className="mt-1 size-4"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>
              <span className="mb-1 block rounded-md bg-muted p-2">
                {notice.en}
                <br />
                {notice.hi}
              </span>
              I have read this notice to the patient and they agree.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={busy || !consent}>
              {busy ? "Creating…" : "Create token"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TokenResult({
  token,
  hospitalName,
  appUrl,
  onNew,
}: {
  token: Created;
  hospitalName: string;
  appUrl: string;
  onNew: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const statusUrl = `${appUrl.replace(/\/$/, "")}/t/${token.code}`;

  useEffect(() => {
    QRCode.toDataURL(statusUrl, { margin: 1, width: 240 }).then(setQr, () => setQr(null));
  }, [statusUrl]);

  const wait = token.peopleAhead === 0 ? "You are next" : `About ${token.estimatedWaitMinutes} min`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Token created</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p className="text-6xl font-bold tracking-tight text-primary" aria-label={`Token ${token.label}`}>
              {token.label}
            </p>
            <p className="text-lg">
              {token.department.nameEn}
              {token.roomName ? ` · ${token.roomName}` : ""}
              {token.doctorName ? ` · ${token.doctorName}` : ""}
            </p>
            <p className="text-muted-foreground">
              {token.peopleAhead} ahead · {wait}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="lg" onClick={() => window.print()}>
                Print slip
              </Button>
              <Button size="lg" variant="outline" onClick={onNew}>
                New token
              </Button>
            </div>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="QR code for the token status page" width={160} height={160} className="mx-auto" /> : <div className="size-40" />}
            <p className="mt-1 text-xs text-muted-foreground">Scan to follow the queue</p>
          </div>
        </CardContent>
      </Card>

      {/* Printed on a 58 mm thermal printer. Shown only in the print dialog (see globals.css). */}
      {createPortal(
        <div className="print-slip-root">
          <p className="slip-hospital">{hospitalName}</p>
          <p className="slip-label">{token.label}</p>
          <p>{token.department.nameEn}</p>
          {token.doctorName && <p>{token.doctorName}</p>}
          {token.roomName && <p>{token.roomName}</p>}
          <p className="slip-small">{new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="" className="slip-qr" />
          )}
          <p className="slip-small">Scan to see your turn</p>
          <p className="slip-small">{token.code}</p>
        </div>,
        document.body,
      )}
    </>
  );
}
