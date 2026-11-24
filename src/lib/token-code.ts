import { randomInt } from "node:crypto";

// No 0/O/1/I/L so codes are easy to read from a slip. 31^8 is about 8.5e11 combinations.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** 8-character unguessable token code used in /t/<code>. */
export function generateTokenCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
