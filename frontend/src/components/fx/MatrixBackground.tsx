"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "0123456789ABCDEF<>/{}[]#$%&*+=-xX";

/** Low-opacity falling hex-dump rain on a canvas. Pauses when the tab is hidden; off for reduced motion. */
export function MatrixBackground({ opacity = 0.16 }: { opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 14;
    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(window.innerWidth / size);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 55) return; // ~18fps is plenty and cheap
      last = t;
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = `${size}px var(--font-mono), monospace`;
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * size;
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillStyle = Math.random() > 0.975 ? "#ffffff" : Math.random() > 0.9 ? "#00e5ff" : "#e60000";
        ctx.fillText(ch, i * size, y);
        if (y > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ opacity }} />;
}
