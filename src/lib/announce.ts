// Text for the TV board's voice announcement, in English and Hindi. Only the token number and
// the room are ever spoken, never a name. Pure functions so they can be unit tested.

export interface Announcement {
  lang: "en-IN" | "hi-IN";
  text: string;
}

// How a Hindi voice should say each Latin letter of the token prefix.
const HINDI_LETTERS: Record<string, string> = {
  A: "ए", B: "बी", C: "सी", D: "डी", E: "ई", F: "एफ", G: "जी", H: "एच", I: "आई", J: "जे",
  K: "के", L: "एल", M: "एम", N: "एन", O: "ओ", P: "पी", Q: "क्यू", R: "आर", S: "एस", T: "टी",
  U: "यू", V: "वी", W: "डब्ल्यू", X: "एक्स", Y: "वाई", Z: "ज़ेड",
};

/** "MED" is spelled out, "M E D" or Hindi letter names, so the voice does not read it as a word. */
export function spellPrefix(prefix: string, lang: Announcement["lang"]): string {
  const letters = prefix.toUpperCase().split("");
  return letters.map((l) => (lang === "hi-IN" ? (HINDI_LETTERS[l] ?? l) : l)).join(" ");
}

/** "Room 4" -> {number: "4"}; "Consultation hall" -> {name: "Consultation hall"}; nothing -> {} */
export function roomSpeech(roomName: string | null): { number?: string; name?: string } {
  const name = roomName?.trim();
  if (!name) return {};
  const m = /(\d+)\s*$/.exec(name);
  return m ? { number: m[1] } : { name };
}

export function buildAnnouncements(prefix: string, seqNo: number, roomName: string | null): Announcement[] {
  const room = roomSpeech(roomName);
  const en = room.number
    ? `Token ${spellPrefix(prefix, "en-IN")} ${seqNo}, room number ${room.number}.`
    : room.name
      ? `Token ${spellPrefix(prefix, "en-IN")} ${seqNo}, please go to ${room.name}.`
      : `Token ${spellPrefix(prefix, "en-IN")} ${seqNo}, please come to the doctor.`;
  const hi = room.number
    ? `टोकन ${spellPrefix(prefix, "hi-IN")} ${seqNo}, कमरा नंबर ${room.number}।`
    : room.name
      ? `टोकन ${spellPrefix(prefix, "hi-IN")} ${seqNo}, कृपया ${room.name} में जाइए।`
      : `टोकन ${spellPrefix(prefix, "hi-IN")} ${seqNo}, कृपया डॉक्टर के पास आइए।`;
  return [
    { lang: "en-IN", text: en },
    { lang: "hi-IN", text: hi },
  ];
}
