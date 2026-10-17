import type { SiteData } from "@/lib/types";

export function Ticker({ ticker }: { ticker: SiteData["ticker"] }) {
  if (!ticker?.enabled) return null;
  const items = [...(ticker.live ?? []), ...(ticker.items ?? [])];
  if (!items.length) return null;
  const row = items.map((t, i) => (
    <span key={i} className="mx-6 inline-flex items-center gap-2">
      <span className="text-blood">◉</span>
      {t}
    </span>
  ));
  return (
    <div className="relative overflow-hidden border-y border-crimson/30 bg-crimson/[0.04] py-2.5 text-[11px] uppercase tracking-[0.25em] text-neutral-400">
      <div className="flex w-max animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
        {row}
        {row}
        {row}
        {row}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black" />
    </div>
  );
}
