"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Media } from "@/lib/types";

export function MediaGallery({ media, fallback }: { media: Media[]; fallback?: React.ReactNode }) {
  const [idx, setIdx] = useState(0);
  if (!media.length) return <>{fallback ?? null}</>;
  const current = media[Math.min(idx, media.length - 1)];

  return (
    <div>
      <div className="card corner-brackets relative aspect-video overflow-hidden bg-black">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.url}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {current.type === "video" ? (
              <video src={current.url} controls playsInline className="h-full w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={current.alt ?? ""} className="h-full w-full object-contain" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {media.map((m, i) => (
            <button
              key={m.url + i}
              onClick={() => setIdx(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden border transition ${
                i === idx ? "border-blood shadow-neon" : "border-line opacity-60 hover:opacity-100"
              }`}
              aria-label={`Show media ${i + 1}`}
            >
              {m.type === "video" ? (
                <span className="grid h-full w-full place-items-center bg-panel text-xs text-blood">▶ VIDEO</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
