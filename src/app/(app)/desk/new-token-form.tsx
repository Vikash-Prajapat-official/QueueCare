"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { apiErrorText } from "@/lib/api-error-text";
import { formatTag, type Locale } from "@/i18n/config";
import { PRIORITIES } from "@/lib/queue-labels";

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
  const t = useTranslations("desk");
  const tc = useTranslations();
  const te = useTranslations("errors");
  const locale = useLocale() as Locale;
  const deptName = (d: { nameEn: string; nameHi: string }) => (locale === "hi" ? d.nameHi : d.nameEn);
  async function readError(res: Response): Promise<string> {
    return apiErrorText(te, locale, await res.json().catch(() => ({})), t("somethingWrong"));
  }
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
    if (data.items.length === 0) setSearchMsg(t("noEarlier"));
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
      setError(te("NETWORK"));
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
        <CardTitle>{t("formTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="phone">{t("patientPhone")}</Label>
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
                {t("findEarlier")}
              </Button>
            </div>
            {searchMsg && <p className="mt-1 text-sm text-muted-foreground">{searchMsg}</p>}
            {matches.length > 0 && (
              <ul className="mt-2 space-y-2" aria-label={t("patientsFound")}>
                {matches.map((m) => (
                  <li key={m.id}>
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => selectMatch(m)}>
                      {t("use", { name: m.name, age: m.age, sex: tc(`sex.${m.sex}`) })}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {locked && (
              <p className="mt-1 text-sm">
                {t("returning")}{" "}
                <button type="button" className="underline" onClick={() => setPatientId(null)}>
                  {t("notThis")}
                </button>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" required value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age">{t("age")}</Label>
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
              <Label htmlFor="sex">{t("sex")}</Label>
              <Select id="sex" required value={sex} disabled={locked} onChange={(e) => setSex(e.target.value)}>
                <option value="">{t("choose")}</option>
                <option value="M">{tc("sex.M")}</option>
                <option value="F">{tc("sex.F")}</option>
                <option value="O">{tc("sex.O")}</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="abha">{t("abha")}</Label>
            <Input id="abha" value={abha} disabled={locked} onChange={(e) => setAbha(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <Label htmlFor="visit">{t("visit")}</Label>
            <Select id="visit" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              <option value="NEW">{tc("visitType.NEW")}</option>
              <option value="FOLLOW_UP">{tc("visitType.FOLLOW_UP")}</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="dept">{t("department")}</Label>
            <Select
              id="dept"
              required
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setDoctorId("");
              }}
            >
              <option value="">{t("choose")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {deptName(d)} ({d.tokenPrefix})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="doctor">{t("doctor")}</Label>
            <Select id="doctor" value={doctorId} disabled={!department} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">{t("anyDoctor")}</option>
              {department?.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                  {d.roomName ? ` (${d.roomName})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">{t("priority")}</Label>
            <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {tc(`priority.${p}`)}
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
              {t("consentTick")}
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={busy || !consent}>
              {busy ? t("creating") : t("create")}
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
  const t = useTranslations("desk");
  const locale = useLocale() as Locale;
  const deptName = locale === "hi" ? token.department.nameHi : token.department.nameEn;
  const [qr, setQr] = useState<string | null>(null);
  const statusUrl = `${appUrl.replace(/\/$/, "")}/t/${token.code}`;

  useEffect(() => {
    QRCode.toDataURL(statusUrl, { margin: 1, width: 240 }).then(setQr, () => setQr(null));
  }, [statusUrl]);

  const wait = token.peopleAhead === 0 ? t("youAreNext") : t("aboutMin", { n: token.estimatedWaitMinutes });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("created")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p className="text-6xl font-bold tracking-tight text-primary" aria-label={t("tokenAria", { label: token.label })}>
              {token.label}
            </p>
            <p className="text-lg">
              {deptName}
              {token.roomName ? ` · ${token.roomName}` : ""}
              {token.doctorName ? ` · ${token.doctorName}` : ""}
            </p>
            <p className="text-muted-foreground">
              {t("ahead", { n: token.peopleAhead })} · {wait}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="lg" onClick={() => window.print()}>
                {t("printSlip")}
              </Button>
              <Button size="lg" variant="outline" onClick={onNew}>
                {t("newToken")}
              </Button>
            </div>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt={t("qrAlt")} width={160} height={160} className="mx-auto" /> : <div className="size-40" />}
            <p className="mt-1 text-xs text-muted-foreground">{t("scanFollow")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Printed on a 58 mm thermal printer. Shown only in the print dialog (see globals.css). */}
      {createPortal(
        <div className="print-slip-root">
          <p className="slip-hospital">{hospitalName}</p>
          <p className="slip-label">{token.label}</p>
          <p>{deptName}</p>
          {token.doctorName && <p>{token.doctorName}</p>}
          {token.roomName && <p>{token.roomName}</p>}
          <p className="slip-small">{new Date().toLocaleString(formatTag(locale), { dateStyle: "medium", timeStyle: "short" })}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="" className="slip-qr" />
          )}
          <p className="slip-small">{t("scanTurn")}</p>
          <p className="slip-small">{token.code}</p>
        </div>,
        document.body,
      )}
    </>
  );
}
