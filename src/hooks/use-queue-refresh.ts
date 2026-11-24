"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEventSource } from "@/hooks/use-event-source";

/**
 * Staff screens: re-read the server data of the page whenever one of these departments changes.
 * Bursts of events are merged into one refresh.
 */
export function useQueueRefresh(departmentIds: readonly string[]) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 150);
  }, [router]);

  const url = departmentIds.length > 0 ? `/api/stream/${departmentIds.join(",")}` : null;
  useEventSource(url, refresh);
}
