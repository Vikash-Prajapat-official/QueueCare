import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, isLocale, pickLocale } from "@/i18n/config";
import { apiErrorText } from "@/lib/api-error-text";

type Tree = { [key: string]: string | Tree };
const load = (locale: string): Tree => JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

// {name} and {n, plural, ...}: the argument names a message uses, in sorted order.
function placeholders(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]/g)) names.add(m[1] as string);
  return [...names].sort();
}

const en = flatten(load("en"));

describe("message files", () => {
  for (const locale of LOCALES) {
    it(`${locale}.json has exactly the keys of en.json`, () => {
      const other = flatten(load(locale));
      expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
    });

    it(`${locale}.json has no empty text`, () => {
      for (const [key, text] of Object.entries(flatten(load(locale)))) {
        expect(text.trim(), key).not.toBe("");
      }
    });

    it(`${locale}.json uses the same placeholders as en.json`, () => {
      for (const [key, text] of Object.entries(flatten(load(locale)))) {
        expect(placeholders(text), key).toEqual(placeholders(en[key] ?? ""));
      }
    });
  }

  it("the Hindi file is really Hindi, not a copy of English", () => {
    const hi = flatten(load("hi"));
    const same = Object.keys(en).filter((k) => hi[k] === en[k] && /[A-Za-z]{4,}/.test(en[k] ?? ""));
    // A few words are the same on purpose (QueueCare, GitHub, MIT, commands).
    expect(same.length, same.join(", ")).toBeLessThan(8);
    const withDevanagari = Object.values(hi).filter((t) => /[ऀ-ॿ]/.test(t)).length;
    expect(withDevanagari / Object.keys(hi).length).toBeGreaterThan(0.9);
  });

  it("every error code the API can send has a translation", () => {
    const codes = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name)) {
          const src = readFileSync(p, "utf8");
          for (const m of src.matchAll(/(?:ApiError\(\s*\d+,|errorResponse\(\s*\d+,)\s*"([A-Z_]+)"/g)) codes.add(m[1] as string);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(codes.size).toBeGreaterThan(10);
    for (const code of codes) expect(en[`errors.${code}`], code).toBeTruthy();
  });

  it("every priority, status, sex and visit type has a name", () => {
    for (const k of ["NORMAL", "ELDERLY", "PREGNANT", "DISABLED", "EMERGENCY"]) expect(en[`priority.${k}`]).toBeTruthy();
    for (const k of ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED", "NO_SHOW", "DONE", "CANCELLED"]) expect(en[`status.${k}`]).toBeTruthy();
    for (const k of ["M", "F", "O"]) expect(en[`sex.${k}`]).toBeTruthy();
    for (const k of ["NEW", "FOLLOW_UP"]) expect(en[`visitType.${k}`]).toBeTruthy();
  });
});

describe("pickLocale", () => {
  it("uses the saved choice first", () => {
    expect(pickLocale("hi", "en-US,en;q=0.9")).toBe("hi");
    expect(pickLocale("en", "hi-IN,hi;q=0.9")).toBe("en");
  });
  it("then the browser language", () => {
    expect(pickLocale(undefined, "hi-IN,hi;q=0.9,en;q=0.8")).toBe("hi");
    expect(pickLocale(undefined, "fr-FR,fr;q=0.9,hi;q=0.5")).toBe("hi");
  });
  it("then English", () => {
    expect(pickLocale(undefined, null)).toBe(DEFAULT_LOCALE);
    expect(pickLocale("xx", "fr-FR")).toBe("en");
  });
  it("isLocale rejects anything else", () => {
    expect(isLocale("hi")).toBe(true);
    expect(isLocale("../etc/passwd")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("apiErrorText", () => {
  const t = Object.assign((k: string) => `T:${k}`, { has: (k: string) => k === "FORBIDDEN" });
  const body = (code: string, message: string) => ({ error: { code, message } });

  it("keeps the server's wording in English", () => {
    expect(apiErrorText(t, "en", body("FORBIDDEN", "Server text"), "fallback")).toBe("Server text");
  });
  it("uses the translation for a known code in Hindi", () => {
    expect(apiErrorText(t, "hi", body("FORBIDDEN", "Server text"), "fallback")).toBe("T:FORBIDDEN");
  });
  it("falls back to the server text, then the fallback", () => {
    expect(apiErrorText(t, "hi", body("OTHER", "Server text"), "fallback")).toBe("Server text");
    expect(apiErrorText(t, "hi", {}, "fallback")).toBe("fallback");
    expect(apiErrorText(t, "en", null, "fallback")).toBe("fallback");
  });
});
