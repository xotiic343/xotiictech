"use client";

// Keeps a /support page up to date without a manual reload. It polls /support/api/live (a few bytes) and
// calls router.refresh() only when the version changes, so the page re-renders on the server with fresh
// data while client state (like a half-typed reply) is kept. Pauses while the tab is hidden and checks
// again right away when you come back to it.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function LiveRefresh({ query, intervalMs = 4000 }: { query: string; intervalMs?: number }) {
  const router = useRouter();
  const version = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch(`/support/api/live?${query}`, { cache: "no-store" });
        if (res.ok) {
          const { data } = (await res.json()) as { data?: { v?: string } };
          const v = data?.v ?? null;
          if (version.current !== null && v !== null && v !== version.current) router.refresh();
          version.current = v;
        }
      } catch {
        // offline for a moment: try again next tick
      }
      if (!stopped) timer = setTimeout(check, intervalMs);
    };

    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      check();
    };

    check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [query, intervalMs, router]);

  return null;
}
