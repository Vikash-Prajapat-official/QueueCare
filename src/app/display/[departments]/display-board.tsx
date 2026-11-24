"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEventSource, type StreamStatus } from "@/hooks/use-event-source";
import { buildAnnouncements, type Announcement } from "@/lib/announce";
import type { DisplayRoom, DisplayState } from "@/lib/display-service";

// Only token numbers, rooms and department names are ever shown or spoken here, never a name.

const FLASH_MS = 12_000;

function callKey(room: DisplayRoom): string | null {
  const c = room.current;
  if (!c || c.status !== "CALLED") return null;
  // A new call, or a recall of the same patient, changes the key and is announced again.
  return `${room.key}|${c.tokenId}|${c.recallCount}|${c.calledAt}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function DisplayBoard({
  ids,
  displayKey,
  initial,
  hospitalName,
}: {
  ids: string;
  displayKey: string;
  initial: DisplayState;
  hospitalName: string;
}) {
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [soundOn, setSoundOn] = useState(false);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState("");
  const [lastSpoken, setLastSpoken] = useState("");

  // Calls already on screen when the page opens are not announced again.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) {
    seen.current = new Set(initial.rooms.map(callKey).filter((k): k is string => k !== null));
  }
  const soundOnRef = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());

  // ---- sound ------------------------------------------------------------------------------

  const chime = useCallback(async () => {
    const ctx = audio.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.3 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.3);
    });
    await sleep(700);
  }, []);

  const speak = useCallback((a: Announcement) => {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const utterance = new SpeechSynthesisUtterance(a.text);
      utterance.lang = a.lang;
      utterance.rate = 0.9;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(a.lang.slice(0, 2)));
      if (voice) utterance.voice = voice;
      const done = () => resolve();
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
      setTimeout(done, 15_000); // never get stuck on a voice that does not answer
    });
  }, []);

  const announce = useCallback(
    (room: DisplayRoom) => {
      const c = room.current;
      if (!c) return;
      const lines = buildAnnouncements(room.prefix, c.seqNo, room.roomName);
      setLastSpoken(lines[0]?.text ?? "");
      if (!soundOnRef.current) return;
      // One announcement at a time, in the order the calls were made.
      chain.current = chain.current.then(async () => {
        await chime();
        for (const line of lines) await speak(line);
      });
    },
    [chime, speak],
  );

  function enableSound() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audio.current = audio.current ?? new Ctx();
    void audio.current?.resume();
    window.speechSynthesis?.getVoices();
    soundOnRef.current = true;
    setSoundOn(true);
    void chime();
  }

  // ---- state ------------------------------------------------------------------------------

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${encodeURIComponent(ids)}?key=${encodeURIComponent(displayKey)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const next: DisplayState = await res.json();
      setState(next);

      const fresh: DisplayRoom[] = [];
      for (const room of next.rooms) {
        const key = callKey(room);
        if (key && !seen.current?.has(key)) {
          seen.current?.add(key);
          fresh.push(room);
        }
      }
      if (fresh.length > 0) {
        setFlashing((prev) => new Set([...prev, ...fresh.map((r) => r.key)]));
        fresh.forEach((room) => {
          announce(room);
          setTimeout(
            () =>
              setFlashing((prev) => {
                const copy = new Set(prev);
                copy.delete(room.key);
                return copy;
              }),
            FLASH_MS,
          );
        });
      }
    } catch {
      // offline: keep showing the last state, the stream retries on its own
    }
  }, [ids, displayKey, announce]);

  useEventSource(`/api/stream/${encodeURIComponent(ids)}?key=${encodeURIComponent(displayKey)}`, load, setStatus, 20_000);

  // ---- clock and screen wake lock ---------------------------------------------------------

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // not supported on this TV browser
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  // ---- screen -----------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white">
      <header className="flex items-center justify-between gap-4 px-[2vw] py-[1.2vh] text-[clamp(1rem,2vw,2.2rem)]">
        <span className="font-semibold">{hospitalName}</span>
        <span className="font-semibold text-yellow-300">Now serving · अभी बुलाया जा रहा है</span>
        <span className="tabular-nums" suppressHydrationWarning>
          {clock}
        </span>
      </header>

      <main className="grid flex-1 gap-[1.2vw] p-[1.2vw] [grid-auto-rows:1fr] [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
        {state.rooms.length === 0 && (
          <p className="col-span-full self-center text-center text-[clamp(1.5rem,3vw,3rem)]">
            No doctors are set up for this screen.
          </p>
        )}
        {state.rooms.map((room) => {
          const c = room.current;
          const calling = c?.status === "CALLED";
          return (
            <section
              key={room.key}
              aria-label={room.title}
              className={`flex min-h-0 flex-col justify-between rounded-2xl border-l-[1.2vw] bg-neutral-900 p-[1.6vw] ${
                flashing.has(room.key) ? "animate-pulse ring-8 ring-yellow-300" : ""
              }`}
              style={{ borderLeftColor: room.color }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[clamp(1.4rem,3vw,3.4rem)] font-bold">{room.title}</h2>
                <p className="text-[clamp(0.9rem,1.5vw,1.8rem)] text-neutral-300">
                  {room.departmentName.en} · {room.departmentName.hi}
                </p>
              </div>

              <div className="text-center">
                {c ? (
                  <>
                    <p
                      className={`text-[clamp(3.5rem,11vw,13rem)] font-extrabold leading-none tabular-nums ${
                        calling ? "text-yellow-300" : "text-neutral-400"
                      }`}
                    >
                      {c.label}
                    </p>
                    <p className="text-[clamp(1rem,1.8vw,2rem)] text-neutral-300">
                      {calling ? "Please go in · कृपया अंदर जाइए" : "In consultation · परामर्श जारी है"}
                    </p>
                  </>
                ) : (
                  <p className="text-[clamp(2rem,5vw,6rem)] font-bold text-neutral-600">—</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[clamp(1rem,2vw,2.4rem)]">
                <span className="text-neutral-400">Next · अगला</span>
                {room.next.length === 0 ? (
                  <span className="text-neutral-600">—</span>
                ) : (
                  room.next.map((label) => (
                    <span key={label} className="rounded-lg bg-neutral-800 px-3 py-1 font-bold tabular-nums">
                      {label}
                    </span>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="flex items-center justify-between gap-4 px-[2vw] py-[1vh] text-[clamp(0.8rem,1.2vw,1.4rem)] text-neutral-400">
        <span>{state.waitingTotal} waiting · प्रतीक्षा में</span>
        {!soundOn ? (
          <button
            type="button"
            onClick={enableSound}
            autoFocus
            className="rounded-lg bg-yellow-300 px-4 py-2 font-bold text-black focus-visible:outline-4 focus-visible:outline-white"
          >
            Press OK to turn on sound · आवाज़ चालू करें
          </button>
        ) : (
          <span>Sound on · आवाज़ चालू</span>
        )}
        <span aria-label={`Connection ${status}`} className="flex items-center gap-2">
          <span
            className={`inline-block size-3 rounded-full ${
              status === "open" ? "bg-green-500" : status === "retrying" ? "bg-red-500" : "bg-yellow-500"
            }`}
          />
          {status === "open" ? "Live" : status === "retrying" ? "Reconnecting…" : "Connecting…"}
        </span>
      </footer>

      <p className="sr-only" aria-live="assertive">
        {lastSpoken}
      </p>
    </div>
  );
}
