import { describe, expect, it } from "vitest";
import { buildAnnouncements, roomSpeech, spellPrefix } from "@/lib/announce";

describe("spellPrefix", () => {
  it("spells the prefix letter by letter in English", () => {
    expect(spellPrefix("MED", "en-IN")).toBe("M E D");
    expect(spellPrefix("ort", "en-IN")).toBe("O R T");
  });

  it("gives Hindi letter names for a Hindi voice", () => {
    expect(spellPrefix("MED", "hi-IN")).toBe("एम ई डी");
    expect(spellPrefix("PED", "hi-IN")).toBe("पी ई डी");
  });
});

describe("roomSpeech", () => {
  it("uses the trailing number of the room name", () => {
    expect(roomSpeech("Room 4")).toEqual({ number: "4" });
    expect(roomSpeech("OPD 12 ")).toEqual({ number: "12" });
  });
  it("uses the whole name when it has no number", () => {
    expect(roomSpeech("Consultation hall")).toEqual({ name: "Consultation hall" });
  });
  it("is empty when there is no room", () => {
    expect(roomSpeech(null)).toEqual({});
    expect(roomSpeech("  ")).toEqual({});
  });
});

describe("buildAnnouncements", () => {
  it("says the token and the room number in English, then Hindi", () => {
    const [en, hi] = buildAnnouncements("MED", 34, "Room 4");
    expect(en).toEqual({ lang: "en-IN", text: "Token M E D 34, room number 4." });
    expect(hi).toEqual({ lang: "hi-IN", text: "टोकन एम ई डी 34, कमरा नंबर 4।" });
  });

  it("names the room when it has no number", () => {
    const [en, hi] = buildAnnouncements("PED", 7, "Consultation hall");
    expect(en?.text).toBe("Token P E D 7, please go to Consultation hall.");
    expect(hi?.text).toContain("Consultation hall");
  });

  it("still works without a room", () => {
    const [en, hi] = buildAnnouncements("GYN", 12, null);
    expect(en?.text).toBe("Token G Y N 12, please come to the doctor.");
    expect(hi?.text).toContain("डॉक्टर");
  });

  it("returns exactly one English and one Hindi announcement", () => {
    expect(buildAnnouncements("MED", 1, "Room 1").map((a) => a.lang)).toEqual(["en-IN", "hi-IN"]);
  });

  it("never needs a patient name", () => {
    // The function only takes a prefix, a number and a room, so a name cannot be spoken.
    expect(buildAnnouncements.length).toBe(3);
  });
});
