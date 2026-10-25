"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { BOOT_KEY } from "@/lib/boot";

const LINES = [
  "XOTIIC BIOS v4.20 — (c) XotiicTech",
  "memory check ........ 65536K OK",
  "mounting /bots ...... OK",
  "mounting /store ..... OK",
  "handshake discord ... OK",
  "ACCESS GRANTED",
];

const KEY = BOOT_KEY;

export function BootSequence() {
  const [visible, setVisible] = useState(true);
  const [shown, setShown] = useState(0);

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setVisible(false);
  }, []);

  useEffect(() => {
    if (document.documentElement.dataset.booted) {
      setVisible(false);
      return;
    }
    // Quick on purpose (~0.75s): it's a flourish on the first visit of a session, not a loading screen.
    const timers = LINES.map((_, i) => setTimeout(() => setShown(i + 1), 60 + i * 90));
    const done = setTimeout(finish, 60 + LINES.length * 90 + 160);
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
      window.removeEventListener("keydown", skip);
    };
  }, [finish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="boot-overlay fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={finish}
          role="presentation"
        >
          <div className="w-full max-w-lg px-6 font-mono text-sm">
            {LINES.slice(0, shown).map((line, i) => (
              <div
                key={line}
                className={i === LINES.length - 1 ? "mt-3 font-display text-lg font-bold text-blood glow-text" : "text-neutral-400"}
              >
                <span className="text-crimson">&gt; </span>
                {line}
              </div>
            ))}
            <span className="inline-block h-4 w-2 animate-blink bg-blood align-middle" />
            <div className="mt-8 text-[10px] uppercase tracking-[0.3em] text-dim">click or press any key to skip</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
