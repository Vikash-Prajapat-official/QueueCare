"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the server data of the current page every few seconds while the tab is visible.
 * A stop-gap until live updates (SSE) arrive in Phase 4. Form state in the page is kept.
 */
export function useAutoRefresh(intervalMs = 5000) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
}
