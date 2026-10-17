import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        ink: "#0a0a0a",
        panel: "#101010",
        line: "#1f1f1f",
        edge: "#2a2a2a",
        muted: "#8a8a8a",
        dim: "#5c5c5c",
        crimson: "#e60000",
        blood: "#ff0033",
        cyan: "#00e5ff",
        amber: "#ffb000",
        ok: "#22ff88",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-mono)", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(230,0,0,.6), 0 0 18px rgba(230,0,0,.35), inset 0 0 12px rgba(230,0,0,.12)",
        "neon-lg": "0 0 0 1px rgba(255,0,51,.8), 0 0 32px rgba(255,0,51,.45), inset 0 0 18px rgba(255,0,51,.18)",
      },
      keyframes: {
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
      },
      animation: {
        blink: "blink 1s steps(1) infinite",
        marquee: "marquee 40s linear infinite",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
