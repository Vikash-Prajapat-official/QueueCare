// CSV for spreadsheets. Text that starts with = + - @ is prefixed with an apostrophe so Excel and
// Sheets do not run it as a formula ("CSV injection").

export const CSV_BOM = "﻿"; // lets Excel read Hindi and other UTF-8 text correctly

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: readonly CsvValue[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}
