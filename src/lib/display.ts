import { createHash, timingSafeEqual } from "node:crypto";

const MIN_KEY_LENGTH = 8;
const MAX_DEPARTMENTS = 12;

/**
 * Checks the TV display key from the URL against DISPLAY_KEY.
 * A missing or very short DISPLAY_KEY never matches, so a forgotten setting cannot open the board.
 * The comparison takes the same time whatever the input.
 */
export function isValidDisplayKey(provided: string | null | undefined, expected = process.env.DISPLAY_KEY): boolean {
  if (!provided || !expected || expected.length < MIN_KEY_LENGTH) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** "id1,id2" from a URL segment into a list of ids, or null if anything looks wrong. */
export function parseDepartmentIds(param: string): string[] | null {
  const ids = [...new Set(decodeURIComponent(param).split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_DEPARTMENTS) return null;
  if (!ids.every((id) => /^[a-z0-9]{8,40}$/.test(id))) return null;
  return ids;
}
