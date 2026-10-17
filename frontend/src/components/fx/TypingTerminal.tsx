"use client";

import { useEffect, useState } from "react";

/** Types out terminal lines one character at a time, ending on a blinking block cursor. */
export function TypingTerminal({ lines, speed = 22 }: { lines: string[]; speed?: number }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLineIdx(lines.length);
      return;
    }
    if (lineIdx >= lines.length) return;
    const line = lines[lineIdx];
    const t =
      charIdx < line.length
        ? setTimeout(() => setCharIdx((c) => c + 1), speed + Math.random() * speed)
        : setTimeout(() => {
            setLineIdx((l) => l + 1);
            setCharIdx(0);
          }, 260);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx, lines, speed]);

  return (
    <div className="card corner-brackets w-full max-w-xl p-4 text-left text-[13px] leading-6 shadow-neon">
      <div className="mb-3 flex items-center gap-1.5 border-b border-line pb-2">
        <span className="h-2.5 w-2.5 rounded-full bg-crimson" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
        <span className="ml-3 text-[10px] uppercase tracking-[0.25em] text-dim">xotiic@core: ~</span>
      </div>
      {lines.slice(0, lineIdx).map((l, i) => (
        <div key={i} className={l.includes("OK") ? "text-neutral-300" : "text-neutral-400"}>
          {colorize(l)}
        </div>
      ))}
      {lineIdx < lines.length && <span className="text-neutral-300">{colorize(lines[lineIdx].slice(0, charIdx))}</span>}
      <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-blink bg-blood" />
    </div>
  );
}

function colorize(s: string) {
  const parts = s.split(/(OK|>)/g);
  return parts.map((p, i) =>
    p === "OK" ? (
      <span key={i} className="text-ok">
        OK
      </span>
    ) : p === ">" ? (
      <span key={i} className="text-crimson">
        &gt;
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
