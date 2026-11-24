"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { apiErrorText } from "@/lib/api-error-text";

export type Row = Record<string, unknown> & { id: string };

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "password" | "number" | "time" | "color" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  /** true: required always. "create": required only when adding. */
  required?: boolean | "create";
  /** Set false to hide the field when adding / editing. */
  onCreate?: boolean;
  onEdit?: boolean;
  /** Empty means "none": sent as null when editing. */
  nullable?: boolean;
  /** Select values are numbers (for example weekday). */
  numeric?: boolean;
  help?: string;
  defaultValue?: string | boolean;
}

export interface ColumnDef {
  header: string;
  key: string;
  kind?: "text" | "bool" | "color";
}

type Values = Record<string, string | boolean>;
type Mode = "create" | "edit";

function initialValues(fields: FieldDef[], row: Row | null): Values {
  const v: Values = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      v[f.name] = row ? Boolean(row[f.name]) : Boolean(f.defaultValue ?? true);
    } else if (row) {
      const raw = row[f.name];
      v[f.name] = f.type === "password" || raw == null ? "" : String(raw);
    } else {
      v[f.name] = typeof f.defaultValue === "string" ? f.defaultValue : "";
    }
  }
  return v;
}

function buildPayload(fields: FieldDef[], values: Values, mode: Mode): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (mode === "create" && f.onCreate === false) continue;
    if (mode === "edit" && f.onEdit === false) continue;
    const v = values[f.name];
    if (f.type === "checkbox") {
      payload[f.name] = Boolean(v);
      continue;
    }
    const text = typeof v === "string" ? v.trim() : "";
    if (text === "") {
      if (mode === "edit" && f.nullable) payload[f.name] = null;
      continue; // blank passwords and optional fields are left out
    }
    payload[f.name] = f.type === "number" || f.numeric ? Number(text) : text;
  }
  return payload;
}

function Cell({ value, kind, yes, no }: { value: unknown; kind?: ColumnDef["kind"]; yes: string; no: string }) {
  if (kind === "bool") return <span>{value ? yes : no}</span>;
  if (kind === "color" && typeof value === "string") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-block size-4 rounded border border-border" style={{ backgroundColor: value }} />
        {value}
      </span>
    );
  }
  return <span>{value == null || value === "" ? "—" : String(value)}</span>;
}

export function AdminCrud(props: {
  /** The thing being managed, already in the user's language (for example "department" or "विभाग"). */
  noun: string;
  endpoint: string;
  rows: Row[];
  columns: ColumnDef[];
  fields: FieldDef[];
  canDelete?: boolean;
  intro?: string;
}) {
  const { noun, endpoint, rows, columns, fields, canDelete } = props;
  const router = useRouter();
  const t = useTranslations("crud");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mode: Mode = editing === "new" ? "create" : "edit";

  function open(target: Row | "new") {
    setEditing(target);
    setValues(initialValues(fields, target === "new" ? null : target));
    setError(null);
  }

  async function send(method: string, url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorText(te, locale, data, t("somethingWrong")));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(te("NETWORK"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload(fields, values, mode);
    const ok =
      editing === "new"
        ? await send("POST", endpoint, payload)
        : await send("PATCH", `${endpoint}/${(editing as Row).id}`, payload);
    if (ok) setEditing(null);
  }

  async function onDelete(row: Row) {
    if (!window.confirm(t("confirmDelete", { noun }))) return;
    await send("DELETE", `${endpoint}/${row.id}`);
  }

  const visible = fields.filter((f) => (mode === "create" ? f.onCreate !== false : f.onEdit !== false));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{props.intro}</p>
        <Button onClick={() => open("new")} disabled={editing !== null}>
          {t("add", { noun })}
        </Button>
      </div>

      {editing !== null && (
        <Card>
          <CardHeader>
            <CardTitle>{editing === "new" ? t("newTitle", { noun }) : t("editTitle", { noun })}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              {visible.map((f) => {
                const id = `f-${f.name}`;
                const required = f.required === true || (f.required === "create" && mode === "create");
                if (f.type === "checkbox") {
                  return (
                    <label key={f.name} htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
                      <input
                        id={id}
                        type="checkbox"
                        className="size-4"
                        checked={Boolean(values[f.name])}
                        onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                      />
                      {f.label}
                    </label>
                  );
                }
                return (
                  <div key={f.name}>
                    <Label htmlFor={id}>
                      {f.label}
                      {required && <span aria-hidden="true"> *</span>}
                    </Label>
                    {f.type === "select" ? (
                      <Select
                        id={id}
                        required={required}
                        value={String(values[f.name] ?? "")}
                        onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                      >
                        <option value="">{f.nullable || !required ? tc("none") : t("choose")}</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        type={f.type === "color" ? "color" : f.type}
                        required={required}
                        autoComplete={f.type === "password" ? "new-password" : "off"}
                        className={f.type === "color" ? "w-20 p-1" : undefined}
                        value={String(values[f.name] ?? "")}
                        onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                      />
                    )}
                    {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
                  </div>
                );
              })}

              {error && (
                <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
                  {error}
                </p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? tc("saving") : tc("save")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
                  {tc("cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editing === null && error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-2 font-medium">
                  {c.header}
                </th>
              ))}
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {tc("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-muted-foreground">
                  {t("empty", { noun })}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2">
                    <Cell value={row[c.key]} kind={c.kind} yes={tc("yes")} no={tc("no")} />
                  </td>
                ))}
                <td className="space-x-2 px-4 py-2 text-right whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => open(row)} disabled={editing !== null}>
                    {tc("edit")}
                  </Button>
                  {canDelete && (
                    <Button size="sm" variant="destructive" onClick={() => onDelete(row)} disabled={busy}>
                      {t("delete")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
