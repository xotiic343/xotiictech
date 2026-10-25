"use client";

import { useEffect, useRef } from "react";

/**
 * Muted looping preview video that only downloads and plays while it's on screen. Grids of product
 * cards used to autoplay every video at once, decoding them all in parallel even off screen.
 * With reduced motion it shows the first frame and doesn't play.
 */
export function LazyVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!video.src) video.src = src; // start downloading only once it's close to the viewport
          if (!still) video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.1 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [src]);

  return <video ref={ref} muted loop playsInline preload="none" className={className} />;
}
