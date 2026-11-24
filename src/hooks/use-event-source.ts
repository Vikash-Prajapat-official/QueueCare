"use client";

import { useEffect, useRef } from "react";

export type StreamStatus = "connecting" | "open" | "retrying";

const MAX_DELAY_MS = 30_000;

/**
 * Keeps a Server-Sent Events connection open and calls `onSignal` whenever the screen should
 * reload its data: when the stream (re)connects, on every queue event, and every `fallbackPollMs`
 * as a safety net. If the connection drops it retries with growing, slightly randomised delays
 * (1 s, 2 s, 4 s ... up to 30 s). Pass `null` to stay disconnected.
 */
export function useEventSource(
  url: string | null,
  onSignal: () => void,
  onStatus?: (status: StreamStatus) => void,
  fallbackPollMs = 30_000,
) {
  const signalRef = useRef(onSignal);
  const statusRef = useRef(onStatus);
  useEffect(() => {
    signalRef.current = onSignal;
    statusRef.current = onStatus;
  });

  useEffect(() => {
    if (!url) return;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const open = () => {
      statusRef.current?.("connecting");
      source = new EventSource(url);
      source.addEventListener("ready", () => {
        attempt = 0;
        statusRef.current?.("open");
        signalRef.current(); // reload the state after every (re)connect
      });
      source.addEventListener("queue", () => signalRef.current());
      source.onerror = () => {
        source?.close();
        source = null;
        if (stopped) return;
        statusRef.current?.("retrying");
        const delay = Math.min(1000 * 2 ** attempt, MAX_DELAY_MS) * (0.8 + Math.random() * 0.4);
        attempt += 1;
        retryTimer = setTimeout(open, delay);
      };
    };
    open();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") signalRef.current();
    }, fallbackPollMs);

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(poll);
      source?.close();
    };
  }, [url, fallbackPollMs]);
}
