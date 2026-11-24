// Finds translation keys used in the code that are missing from messages/en.json or hi.json.
// Run: node scripts/check-messages.mjs   (exit code 1 if anything is missing)
import fs from "node:fs";
import path from "node:path";

const load = (l) => JSON.parse(fs.readFileSync(`messages/${l}.json`, "utf8"));
const messages = { en: load("en"), hi: load("hi") };
const has = (tree, key) => key.split(".").reduce((n, k) => (n && typeof n === "object" ? n[k] : undefined), tree) !== undefined;

const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(n)) files.push(p);
  }
})("src");

let missing = 0;
let checked = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const vars = new Map(); // translator variable -> namespace ("" = root)
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)")?\s*\)/g)) vars.set(m[1], m[2] ?? "");
  // const [t, locale] = await Promise.all([getTranslations("ns"), ...])
  for (const m of src.matchAll(/const\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\[([^\]]+)\]/g)) {
    const names = m[1].split(",").map((s) => s.trim());
    const calls = [...m[2].matchAll(/getTranslations\(\s*(?:"([^"]*)")?\s*\)|(\w+\([^)]*\))/g)];
    calls.forEach((c, i) => { if (c[0].startsWith("getTranslations") && names[i]) vars.set(names[i], c[1] ?? ""); });
  }
  for (const [v, ns] of vars) {
    for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])` + v + String.raw`(?:\.rich)?\(\s*"([^"]+)"`, "g"))) {
      const key = ns ? `${ns}.${m[1]}` : m[1];
      checked++;
      for (const l of ["en", "hi"]) if (!has(messages[l], key)) { console.log(`${l}: ${key}  (${f})`); missing++; }
    }
  }
}
console.log(missing === 0 ? `All ${checked} translation keys used in the code exist in en.json and hi.json.` : `${missing} missing`);
process.exit(missing === 0 ? 0 : 1);
