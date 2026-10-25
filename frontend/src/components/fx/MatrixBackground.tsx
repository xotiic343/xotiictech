"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "0123456789ABCDEF<>/{}[]#$%&*+=-xX";

/**
 * Low-opacity falling hex-dump rain on a canvas. Pauses when the tab is hidden; off for reduced motion.
 *
 * Performance notes (it runs behind every page):
 * - Drawn at CSS-pixel resolution, not devicePixelRatio: it's a 16%-opacity background, so 2x/3x
 *   rendering only cost 4-9x more pixels per frame on high-DPI screens for no visible gain.
 * - Opaque context ({ alpha: false }) is cheaper to composite; the site background is black anyway.
 * - The font is resolved once. Canvas can't read CSS variables, so the old per-frame
 *   `var(--font-mono)` assignment was both invalid and re-parsed on every frame.
 * - ~15 fps, and ~8 fps on low-power devices or with Data Saver on.
 */
export function MatrixBackground({ opacity = 0.16 }: { opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    const lowPower = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData === true;
    const frameMs = lowPower ? 120 : 66;
    const size = 14;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";

    let w = 0;
    let h = 0;
    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    let resizeRaf = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      // Resizing a canvas resets its state, so the font and background are set here.
      ctx.font = `${size}px ${family}, monospace`;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      cols = Math.ceil(w / size);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };

    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < frameMs) return;
      last = t;
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * size;
        const r = Math.random();
        ctx.fillStyle = r > 0.975 ? "#ffffff" : r > 0.9 ? "#00e5ff" : "#e60000";
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
      style={{ opacity, transform: "translateZ(0)" }}
    />
  );
}
