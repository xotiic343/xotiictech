"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** First-party page-view beacon (path + referrer only, no cookies or third parties). */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/xotiic")) return;
    const body = JSON.stringify({ path: pathname.slice(0, 300), referrer: document.referrer.slice(0, 500) || null });
    fetch("/api/analytics/view", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(
      () => {},
    );
  }, [pathname]);
  return null;
}
