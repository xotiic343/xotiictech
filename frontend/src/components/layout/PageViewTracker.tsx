"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const DEDUPE_MS = 30 * 60 * 1000;

/**
 * First-party page-view beacon (path + referrer only, no cookies or third parties).
 * Skips admin/staff pages, and doesn't resend a page this tab already reported in the last 30 minutes.
 * The API dedupes and filters bots too.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/xotiic") || pathname.startsWith("/support/exotic")) return;
    try {
      const key = `xt_pv:${pathname}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < DEDUPE_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // storage blocked (private mode): the API still dedupes
    }
    const body = JSON.stringify({ path: pathname.slice(0, 300), referrer: document.referrer.slice(0, 500) || null });
    fetch("/api/analytics/view", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(
      () => {},
    );
  }, [pathname]);
  return null;
}
