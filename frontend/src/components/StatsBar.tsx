"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { compact } from "@/lib/format";

function Counter({ value }: { value: number | string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || typeof value !== "number") return;
    const c = animate(0, value, { duration: 1.2, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, value]);
  return <span ref={ref}>{typeof value === "number" ? compact(n) : compact(value)}</span>;
}

export function StatsBar({ stats }: { stats: { label: string; value: number | string | null }[] }) {
  return (
    <div className="grid grid-cols-2 border border-line bg-ink/80 md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`relative px-5 py-6 text-center ${i % 2 === 1 ? "border-l border-line" : ""} ${
            i >= 2 ? "border-t border-line md:border-t-0" : ""
          } ${i >= 1 ? "md:border-l" : ""}`}
        >
          <div className="font-display text-3xl font-black text-white glow-text sm:text-4xl">
            <Counter value={s.value} />
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
