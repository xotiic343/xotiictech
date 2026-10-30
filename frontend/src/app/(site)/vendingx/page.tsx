"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/fx/Reveal";

/* ── Types ── */

interface StockItem {
  name: string;
  description: string;
  count: number;
  premium: boolean;
}

interface User {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  hasPremium?: boolean;
}

/* ── SVG icons (Lucide ISC license) ── */

const I = "h-7 w-7";
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ICONS: Record<string, ReactNode> = {
  steam: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <line x1="6" x2="10" y1="11" y2="11" /><line x1="8" x2="8" y1="9" y2="13" /><line x1="15" x2="15.01" y1="12" y2="12" /><line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  ),
  netflix: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 3v18" /><path d="M17 7.5h4" /><path d="M17 16.5h4" />
    </svg>
  ),
  spotify: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M21 16V3a1 1 0 0 0-1.28-.96l-10 2.917a1 1 0 0 0-.72.96V19" /><circle cx="18" cy="16" r="3" /><circle cx="6" cy="19" r="3" />
    </svg>
  ),
  nitro: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M10.5 3 8 9l4 13 4-13-2.5-6" /><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" /><path d="M2 9h20" />
    </svg>
  ),
  minecraft: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" /><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
    </svg>
  ),
  roblox: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" /><rect x="14" y="2" width="8" height="8" rx="1" />
    </svg>
  ),
  epic: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
    </svg>
  ),
  ubisoft: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /><circle cx="12" cy="13" r="3" />
    </svg>
  ),
  onlyfans: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    </svg>
  ),
  mega: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  combo: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  ip: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
    </svg>
  ),
  random: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
  premium: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" />
    </svg>
  ),
  r6: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" className={I} {...S}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  ),
};

function slotIcon(name: string): ReactNode {
  const n = name.toLowerCase();
  for (const [key, icon] of Object.entries(ICONS)) {
    if (key !== "default" && n.includes(key)) return icon;
  }
  return ICONS.default;
}

/* ── Screw component ── */

function Screw({ className }: { className?: string }) {
  return (
    <span
      className={`absolute h-3 w-3 rounded-full ${className ?? ""}`}
      style={{
        background: "radial-gradient(circle at 35% 35%, #555, #222 60%, #111)",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,.15), 0 1px 3px rgba(0,0,0,.6)",
      }}
    >
      <span
        className="absolute left-1/2 top-1/2 h-[1px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45"
        style={{ background: "rgba(0,0,0,.5)" }}
      />
    </span>
  );
}

/* ── Coil spring SVG ── */

function CoilSpring() {
  return (
    <svg className="vx-coil absolute bottom-0 left-1/2 -z-[1] h-8 w-12 -translate-x-1/2 opacity-20" viewBox="0 0 48 32" fill="none" stroke="rgba(230,0,0,.5)" strokeWidth="1.5">
      <path d="M8 28 C12 20, 16 12, 24 12 S36 20, 40 28" />
      <path d="M10 28 C14 22, 18 16, 24 16 S34 22, 38 28" />
      <path d="M12 28 C16 24, 20 20, 24 20 S32 24, 36 28" />
    </svg>
  );
}

/* ── Product image with PNG fallback ── */

function ProductImage({ type, name, className }: { type: string; name: string; className?: string }) {
  const [imgOk, setImgOk] = useState(true);
  const src = `/vendingx/products/${type.replace("premium_", "").replace(/\s+/g, "_").toLowerCase()}.png`;

  if (!imgOk) {
    return <span className={className}>{slotIcon(name)}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`object-contain drop-shadow-[0_0_6px_rgba(230,0,0,.3)] ${className ?? "h-8 w-8"}`}
      onError={() => setImgOk(false)}
    />
  );
}

/* ── Constants ── */

const SLOT_IDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4"];
const POLL_MS = 30_000;
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/xotiictech";

/* ── Page ── */

export default function VendingXPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stock, setStock] = useState<Record<string, StockItem>>({});
  const [selected, setSelected] = useState<{ slotId: string; type: string } | null>(null);
  const [lcd, setLcd] = useState("SELECT A SLOT");
  const [shaking, setShaking] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showDiscord, setShowDiscord] = useState(false);
  const [vendPhase, setVendPhase] = useState<"idle" | "dispensing" | "tray" | "done">("idle");
  const [dispensedProduct, setDispensedProduct] = useState<{ type: string; name: string } | null>(null);
  const keyBuf = useRef("");

  /* ── Auth check (NextAuth) ── */

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/support/api/auth/session", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.user?.discordId) return;
        const u: User = data.user;
        const prem = await fetch(`/vendingx/api/premium?userId=${u.discordId}`);
        if (prem.ok) {
          const { premium } = await prem.json();
          u.hasPremium = premium;
        }
        setUser(u);
      } catch { /* not logged in */ }
    })();
  }, []);

  /* ── Stock polling (reads Discord channels via bot token on server) ── */

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch("/vendingx/api/stock");
      if (res.ok) setStock(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchStock();
    const id = setInterval(fetchStock, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStock]);

  /* ── Keyboard handler ── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const k = e.key.toUpperCase();
      if (["A", "B", "C", "1", "2", "3", "4"].includes(k)) {
        keyBuf.current += k;
        if (keyBuf.current.length >= 2) {
          const slotId = keyBuf.current.substring(0, 2);
          keyBuf.current = "";
          const idx = SLOT_IDS.indexOf(slotId);
          if (idx >= 0) {
            const entries = Object.entries(stock);
            if (idx < entries.length) {
              const [typeKey] = entries[idx];
              setSelected({ slotId, type: typeKey });
              setLcd(`${slotId}: ${entries[idx][1].name}`);
            }
          }
        }
      } else if (k === "ESCAPE") {
        keyBuf.current = "";
        setSelected(null);
        setLcd("SELECT A SLOT");
        setShowLogin(false);
        setShowDiscord(false);
      } else if (k === "ENTER" && selected && vendPhase === "idle") {
        doVend();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── Vend (redirects to Discord) ── */

  function doVend() {
    if (!selected || vendPhase !== "idle") return;

    if (!user) {
      setShowLogin(true);
      setLcd("LOGIN REQUIRED");
      return;
    }

    const info = stock[selected.type];
    setDispensedProduct({ type: selected.type, name: info?.name || selected.type });
    setShowLogin(false);
    setShowDiscord(false);
    setVendPhase("dispensing");
    setShaking(true);
    setLcd("DISPENSING...");

    setTimeout(() => setShaking(false), 600);

    setTimeout(() => {
      setVendPhase("tray");
      setLcd("ITEM DISPENSED");
    }, 900);

    setTimeout(() => {
      setVendPhase("done");
      setShowDiscord(true);
      const cmd = `/vend ${selected.type}`;
      setLcd(`USE: ${cmd}`);
    }, 2200);
  }

  /* ── Helpers ── */

  function selectSlot(slotId: string, typeKey: string, info: StockItem) {
    if (info.count === 0) return;
    setSelected({ slotId, type: typeKey });
    setLcd(`${slotId}: ${info.name}`);
    setShowLogin(false);
    setShowDiscord(false);
    setVendPhase("idle");
    setDispensedProduct(null);
  }

  function handleKeypad(k: string) {
    if (k === "CLR") {
      keyBuf.current = "";
      setSelected(null);
      setLcd("SELECT A SLOT");
      return;
    }
    keyBuf.current += k;
    if (keyBuf.current.length >= 2) {
      const slotId = keyBuf.current.substring(0, 2);
      keyBuf.current = "";
      const idx = SLOT_IDS.indexOf(slotId);
      if (idx >= 0) {
        const entries = Object.entries(stock);
        if (idx < entries.length) {
          const [typeKey, info] = entries[idx];
          selectSlot(slotId, typeKey, info);
        }
      } else {
        setLcd("INVALID SLOT");
      }
    }
  }

  const entries = Object.entries(stock);
  const totalStock = Object.values(stock).reduce((a, s) => a + s.count, 0);

  /* ── Discord icon SVG (shared) ── */

  const discordSvg = (
    <svg width="14" height="11" viewBox="0 0 71 55" fill="currentColor">
      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9.2.2 0 0010.4 5C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0018-9v-.1c1.4-14.8-2.3-27.7-9.9-39.1a.2.2 0 00-.1-.1zM23.7 37.1c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.8 6.9-6.2 6.9zm22.9 0c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.7 6.9-6.2 6.9z" />
    </svg>
  );

  /* ── RENDER ── */

  return (
    <section className="container-x py-12">
      {/* Login bar */}
      <div className="mb-6 flex items-center justify-between border-b border-line bg-black/90 px-4 py-2">
        <span className="font-display text-[11px] uppercase tracking-[0.2em] text-blood">
          Vending X
        </span>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`}
                    alt="" className="h-6 w-6 rounded-full border border-line"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full border border-line bg-panel" />
                )}
                <span className="text-[11px] uppercase tracking-wider text-muted">
                  <span className="text-crimson">&gt; </span>
                  {user.globalName || user.username}
                </span>
                {user.hasPremium && (
                  <span className="vx-premium-badge border border-blood/60 bg-blood/20 px-1.5 py-0.5 font-display text-[9px] font-bold tracking-wider text-blood">
                    PREMIUM
                  </span>
                )}
              </div>
              <button
                onClick={async () => {
                  const csrf = await fetch("/support/api/auth/csrf", { credentials: "include" }).then(r => r.json());
                  const form = new FormData();
                  form.append("csrfToken", csrf.csrfToken);
                  form.append("callbackUrl", "/vendingx");
                  await fetch("/support/api/auth/signout", { method: "POST", body: form, credentials: "include" });
                  setUser(null);
                  window.location.reload();
                }}
                className="btn-ghost btn-sm"
              >
                Log out
              </button>
            </>
          ) : (
            <a href="/support/api/auth/signin?callbackUrl=/vendingx" className="btn-primary btn-sm inline-flex items-center gap-2">
              {discordSvg}
              Login with Discord
            </a>
          )}
        </div>
      </div>

      {/* Neon title */}
      <Reveal>
        <h1
          className="vx-neon mb-10 text-center font-display text-4xl font-black tracking-[0.25em] text-blood sm:text-5xl"
          style={{
            textShadow:
              "0 0 7px rgba(230,0,0,.8), 0 0 20px rgba(230,0,0,.6), 0 0 42px rgba(230,0,0,.4), 0 0 82px rgba(230,0,0,.2)",
          }}
        >
          VENDING X
        </h1>
      </Reveal>

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
        {/* ─── Machine body ── */}
        <div>
          {/* Outer metallic frame */}
          <div
            className="relative rounded-lg p-[3px]"
            style={{
              background: "linear-gradient(180deg, #3a1515, #1a0808 30%, #0a0303 70%, #2a0d0d)",
              boxShadow: "0 25px 80px rgba(0,0,0,.9), 0 0 0 1px rgba(230,0,0,.1), 0 0 60px rgba(230,0,0,.04)",
            }}
          >
            {/* Corner screws */}
            <Screw className="left-2 top-2 z-20" />
            <Screw className="right-2 top-2 z-20" />
            <Screw className="bottom-2 left-2 z-20" />
            <Screw className="bottom-2 right-2 z-20" />

            {/* Inner machine */}
            <div
              className={`relative overflow-hidden rounded-[5px] transition-transform ${shaking ? "vx-shake" : ""}`}
              style={{
                background: "linear-gradient(180deg, #1a0000 0%, #0a0a0a 20%, #080404 60%, #0d0000 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.03), inset 0 -1px 0 rgba(0,0,0,.5)",
              }}
            >
              {/* Top metal strip with brand plate */}
              <div
                className="relative flex items-center justify-between px-5 py-3"
                style={{ background: "linear-gradient(180deg, #2a0a0a, #1a0505 50%, #150404)" }}
              >
                {/* Brushed metal texture overlay */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[.03]"
                  style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.1) 1px, rgba(255,255,255,.1) 2px)" }}
                />
                <div className="relative flex items-center gap-3">
                  {/* Power LED */}
                  <span className="vx-led h-2.5 w-2.5 rounded-full bg-blood" style={{ boxShadow: "0 0 8px rgba(230,0,0,.8), 0 0 16px rgba(230,0,0,.4)" }} />
                  {/* Brand plate */}
                  <span
                    className="border border-blood/30 bg-gradient-to-b from-blood/20 to-transparent px-3 py-0.5 font-display text-[10px] tracking-[0.35em] text-blood/90"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,.4)" }}
                  >
                    VENDING X
                  </span>
                </div>
                <div className="relative flex items-center gap-3">
                  <span className="font-display text-[8px] tracking-[0.2em] text-blood/30">MODEL VX-2000</span>
                  <span className="font-display text-[9px] tracking-wider text-dim">by XotiicTech</span>
                </div>
              </div>

              {/* Glass panel with thick frame */}
              <div className="relative mx-3 mt-3">
                {/* Glass frame (thick border effect) */}
                <div
                  className="rounded-sm border-2 border-crimson/20 p-[2px]"
                  style={{
                    background: "linear-gradient(180deg, rgba(230,0,0,.08), rgba(230,0,0,.02) 50%, rgba(0,0,0,.3))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(0,0,0,.5)",
                  }}
                >
                  {/* Glass inner */}
                  <div className="relative overflow-hidden bg-black/80 p-3 sm:p-4">
                    {/* Multi-layer glass reflections */}
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,.06) 0%, transparent 25%), linear-gradient(225deg, rgba(230,0,0,.03) 0%, transparent 40%)",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute -right-16 -top-16 z-10 h-48 w-48 rotate-45 opacity-[.04]"
                      style={{ background: "radial-gradient(ellipse, white, transparent 60%)" }}
                    />
                    <div
                      className="pointer-events-none absolute -left-10 bottom-0 z-10 h-32 w-32 rotate-12 opacity-[.015]"
                      style={{ background: "radial-gradient(circle, white, transparent 50%)" }}
                    />
                    {/* Scanline overlay on glass */}
                    <div
                      className="vx-scanlines pointer-events-none absolute inset-0 z-10 opacity-[.02]"
                      style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.1) 2px, rgba(255,255,255,.1) 4px)" }}
                    />

                    {/* Slot grid */}
                    <div className="relative z-[1] grid grid-cols-4 gap-2 sm:gap-3">
                      {SLOT_IDS.map((slotId, i) => {
                        const hasItem = i < entries.length;
                        const [typeKey, info] = hasItem ? entries[i] : ["", null];
                        const soldOut = !info || info.count === 0;
                        const isSelected = selected?.slotId === slotId;

                        return (
                          <button
                            key={slotId}
                            onClick={() => info && selectSlot(slotId, typeKey, info)}
                            disabled={soldOut}
                            aria-label={info ? `${slotId}: ${info.name}, ${info.count} left` : `${slotId}: Empty`}
                            className={`group relative flex min-h-[130px] flex-col items-center justify-center gap-1.5 border p-2 transition-all duration-200 sm:p-3 ${
                              isSelected
                                ? "vx-selected border-blood bg-blood/10 shadow-[0_0_24px_rgba(230,0,0,.2)]"
                                : soldOut
                                ? "cursor-not-allowed border-line/20 bg-black/70 opacity-25"
                                : "border-line/40 bg-black/40 hover:border-crimson/60 hover:bg-blood/5 hover:shadow-[0_0_12px_rgba(230,0,0,.08)]"
                            }`}
                          >
                            {/* Coil spring behind product */}
                            {info && !soldOut && <CoilSpring />}

                            {/* Status LED */}
                            <span
                              className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${!soldOut ? "vx-led-green" : ""}`}
                              style={{
                                background: soldOut ? "#ff2d2d" : "#00ff5e",
                                boxShadow: soldOut ? "0 0 4px #ff2d2d" : "0 0 6px #00ff5e, 0 0 14px #00ff5e",
                              }}
                            />

                            {/* Premium badge */}
                            {info?.premium && (
                              <span
                                className="absolute left-1 top-1 border border-blood/60 bg-blood/80 px-1 py-px font-display text-[7px] font-bold tracking-wider text-white"
                                style={{ boxShadow: "0 0 8px rgba(230,0,0,.4)" }}
                              >
                                PREM
                              </span>
                            )}

                            {/* Slot label */}
                            <span className="font-display text-[10px] font-bold tracking-wider text-blood/80">{slotId}</span>

                            {/* Product visual — drops when dispensing */}
                            <div className={`flex flex-col items-center gap-1.5 ${vendPhase === "dispensing" && isSelected ? "vx-dropping" : ""}`}>
                              <span className={`transition-all duration-200 ${isSelected ? "scale-110 text-blood" : "text-neutral-500 group-hover:text-neutral-400 group-hover:scale-105"}`}>
                                {info ? <ProductImage type={typeKey} name={info.name} /> : ICONS.default}
                              </span>
                              <span className="text-center text-[10px] font-semibold leading-tight text-neutral-300 sm:text-xs">
                                {info?.name || "Empty"}
                              </span>
                            </div>

                            {/* Stock count with bar */}
                            {info && (
                              <div className="flex items-center gap-1">
                                <div className="flex gap-px">
                                  {Array.from({ length: 5 }).map((_, j) => (
                                    <span
                                      key={j}
                                      className="h-1 w-1.5 rounded-[1px]"
                                      style={{
                                        background: j < Math.min(Math.ceil((info.count / 50) * 5), 5)
                                          ? info.count > 10 ? "#00ff5e" : info.count > 3 ? "#ffaa00" : "#ff2d2d"
                                          : "rgba(255,255,255,.08)",
                                      }}
                                    />
                                  ))}
                                </div>
                                <span className="font-display text-[8px] text-dim">{info.count}</span>
                              </div>
                            )}

                            {/* Sold out overlay */}
                            {soldOut && (
                              <>
                                <span
                                  className="pointer-events-none absolute inset-0"
                                  style={{
                                    background:
                                      "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(230,0,0,.03) 5px, rgba(230,0,0,.03) 7px)",
                                  }}
                                />
                                <span className="absolute bottom-2 font-display text-[7px] tracking-wider text-red-500/60">SOLD OUT</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Control panel */}
              <div
                className="relative mx-3 my-3 overflow-hidden border border-crimson/15 p-4"
                style={{
                  background: "linear-gradient(180deg, #1c0606, #100303 50%, #0c0202)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.02)",
                }}
              >
                {/* Brushed metal texture */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[.02]"
                  style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.1) 1px, rgba(255,255,255,.1) 2px)" }}
                />

                <div className="relative flex flex-wrap items-center justify-center gap-5">
                  {/* Coin slot */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="relative h-10 w-3 overflow-hidden rounded-sm border border-crimson/20"
                      style={{
                        background: "linear-gradient(90deg, #0a0303, #1a0808 40%, #0a0303)",
                        boxShadow: "inset 0 2px 6px rgba(0,0,0,.9), 0 0 4px rgba(230,0,0,.05)",
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.06), transparent)" }} />
                    </div>
                    <span className="font-display text-[6px] tracking-[0.3em] text-blood/30">INSERT COIN</span>
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {["A", "B", "C", "1", "2", "3", "4", "CLR"].map((k) => (
                      <button
                        key={k}
                        onClick={() => handleKeypad(k)}
                        className={`vx-key flex h-10 w-11 items-center justify-center rounded-sm border font-display text-[11px] font-bold transition-all active:translate-y-[1px] ${
                          k === "CLR"
                            ? "border-red-900/60 bg-red-950/40 text-red-400 hover:bg-red-950/60"
                            : "border-crimson/25 bg-black/50 text-blood hover:border-crimson/50 hover:bg-blood/10"
                        }`}
                        style={{
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), inset 0 -2px 3px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.3)",
                        }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>

                  {/* LCD display with scanlines */}
                  <div className="relative min-w-[170px] overflow-hidden rounded-sm border border-crimson/25 bg-black px-3 py-3">
                    {/* CRT scanline overlay */}
                    <div
                      className="pointer-events-none absolute inset-0 z-10 opacity-30"
                      style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,.3) 1px, rgba(0,0,0,.3) 2px)" }}
                    />
                    {/* Screen glow */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-20"
                      style={{ background: "radial-gradient(ellipse at center, rgba(230,0,0,.3), transparent 70%)" }}
                    />
                    <div
                      className="vx-lcd relative z-[1] text-center font-display text-xs tracking-wider"
                      style={{
                        color: "#ff3333",
                        textShadow: "0 0 8px rgba(230,0,0,.7), 0 0 20px rgba(230,0,0,.3)",
                      }}
                    >
                      {lcd}
                    </div>
                    {/* Curved glass effect on LCD */}
                    <div
                      className="pointer-events-none absolute inset-0 z-20"
                      style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,.03) 0%, transparent 30%, transparent 70%, rgba(0,0,0,.1) 100%)",
                        boxShadow: "inset 0 2px 8px rgba(0,0,0,.6), inset 0 -1px 4px rgba(0,0,0,.3), 0 0 6px rgba(230,0,0,.04)",
                      }}
                    />
                  </div>

                  {/* VEND button with chrome ring */}
                  <div className="relative">
                    {/* Chrome ring */}
                    <div
                      className={`absolute -inset-1.5 rounded-full ${selected ? "vx-vend-pulse" : ""}`}
                      style={{
                        background: "conic-gradient(from 0deg, #4a1515, #2a0808, #1a0505, #4a1515)",
                        boxShadow: selected
                          ? "0 0 24px rgba(230,0,0,.2), inset 0 0 8px rgba(0,0,0,.5)"
                          : "inset 0 0 8px rgba(0,0,0,.5)",
                      }}
                    />
                    <button
                      onClick={doVend}
                      disabled={!selected || vendPhase !== "idle"}
                      className="group relative h-20 w-20 rounded-full p-1 transition hover:scale-[1.03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed sm:h-24 sm:w-24"
                      style={{
                        background: "linear-gradient(145deg, #2a0000, #1a0000)",
                        boxShadow: "0 4px 20px rgba(0,0,0,.8), 0 0 0 2px rgba(230,0,0,.15)",
                      }}
                    >
                      <span
                        className="flex h-full w-full items-center justify-center rounded-full font-display text-sm font-black tracking-[0.2em] text-white sm:text-base"
                        style={{
                          background: selected
                            ? "linear-gradient(145deg, #dd0000, #990000)"
                            : "linear-gradient(145deg, #cc0000, #8b0000)",
                          boxShadow: "inset 0 2px 4px rgba(255,255,255,.2), inset 0 -3px 6px rgba(0,0,0,.4), 0 0 16px rgba(230,0,0,.3)",
                        }}
                      >
                        VEND
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dispensing tray */}
              <div className="relative mx-3 mb-3">
                {/* Tray flap */}
                <div
                  className="h-2 border-x border-t border-crimson/15"
                  style={{
                    background: "linear-gradient(180deg, rgba(230,0,0,.04), transparent)",
                    borderRadius: "2px 2px 0 0",
                  }}
                />
                {/* Tray opening */}
                <div
                  className="min-h-[48px] overflow-hidden border border-t-0 border-crimson/15 bg-black/70"
                  style={{ boxShadow: "inset 0 6px 16px rgba(0,0,0,.8), inset 0 0 0 1px rgba(0,0,0,.3)" }}
                >
                  {/* Inner tray depth lines */}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-3 opacity-20"
                    style={{ background: "repeating-linear-gradient(90deg, transparent 0px, transparent 8px, rgba(230,0,0,.1) 8px, rgba(230,0,0,.1) 9px)" }}
                  />

                  {/* Dispensed product popup */}
                  {(vendPhase === "tray" || vendPhase === "done") && dispensedProduct && (
                    <div className="vx-tray-popup flex items-center gap-4 border-b border-crimson/10 p-5">
                      <div
                        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-blood/40 bg-blood/10"
                        style={{ boxShadow: "0 0 20px rgba(230,0,0,.15), inset 0 0 10px rgba(0,0,0,.3)" }}
                      >
                        <ProductImage type={dispensedProduct.type} name={dispensedProduct.name} className="h-10 w-10" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold tracking-wider text-blood">{dispensedProduct.name}</div>
                        <div className="mt-0.5 text-xs text-green-400/80">Item dispensed!</div>
                        <div className="mt-1 text-[10px] text-muted">Collect it in Discord below</div>
                      </div>
                    </div>
                  )}

                  {showLogin && (
                    <div className="vx-slide-up flex flex-col items-center gap-3 p-6">
                      <p className="text-sm text-neutral-300">Log in with Discord to continue.</p>
                      <a href="/support/api/auth/signin?callbackUrl=/vendingx" className="btn-primary btn-sm inline-flex items-center gap-2">
                        {discordSvg}
                        Login with Discord
                      </a>
                    </div>
                  )}

                  {showDiscord && selected && (
                    <div className="vx-slide-up flex flex-col items-center gap-3 p-6">
                      <p className="text-sm text-neutral-300">
                        Use <code className="rounded bg-blood/20 px-1.5 py-0.5 font-mono text-xs text-blood">/vend {selected.type}</code> in Discord to get your item.
                      </p>
                      <a
                        href={DISCORD_INVITE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary btn-sm inline-flex items-center gap-2"
                      >
                        {discordSvg}
                        Open Discord Server
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom strip with vent holes */}
              <div
                className="relative flex items-center justify-between px-5 py-2.5"
                style={{ background: "linear-gradient(180deg, #1a0505, #0f0202 50%, #0c0101)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-dim">{totalStock} items in stock</span>
                  {/* Vent holes */}
                  <div className="flex gap-1 opacity-20">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i} className="h-[3px] w-3 rounded-full bg-blood/30" />
                    ))}
                  </div>
                </div>
                <span className="text-[9px] tracking-wider text-blood/30">
                  <span className="vx-led-tiny inline-block h-1.5 w-1.5 rounded-full bg-blood/80 align-middle" /> POWERED BY XOTIICTECH
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Sidebar ── */}
        <aside className="space-y-4">
          {/* How to vend */}
          <div className="card sticky top-20">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="vx-led h-2 w-2 rounded-full bg-blood" style={{ boxShadow: "0 0 6px rgba(230,0,0,.5)" }} />
              <span className="font-display text-xs font-bold tracking-[0.15em] text-blood">HOW TO VEND</span>
            </div>
            <div className="space-y-3 p-4 text-xs text-muted">
              <div className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-blood/40 bg-blood/10 font-display text-[10px] text-blood">1</span>
                <span>Join the Discord server</span>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-blood/40 bg-blood/10 font-display text-[10px] text-blood">2</span>
                <span>Use <code className="rounded bg-blood/10 px-1 font-mono text-blood">/vend</code> to pick an item</span>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-blood/40 bg-blood/10 font-display text-[10px] text-blood">3</span>
                <span>Beta items are <span className="text-green-400">free</span> — Premium requires access</span>
              </div>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-sm mt-2 flex w-full items-center justify-center gap-2"
              >
                {discordSvg}
                Join Discord
              </a>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="font-display text-xs font-bold tracking-[0.15em] text-blood">UPGRADE</span>
            </div>
            <div className="space-y-3 p-4">
              <a
                href="/store"
                className="group block border border-blood/30 bg-blood/5 p-3 transition hover:border-blood/60 hover:bg-blood/10"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold tracking-wider text-blood">PREMIUM</span>
                  <span className="font-display text-sm font-bold text-white">$3</span>
                </div>
                <p className="mt-1 text-[10px] text-muted">Unlock premium stock items</p>
                <span className="mt-2 inline-block font-display text-[8px] tracking-wider text-blood/40 transition group-hover:text-blood/70">GET ACCESS &rarr;</span>
              </a>
              <a
                href="/store"
                className="group block border border-line/60 bg-black/40 p-3 transition hover:border-crimson/40 hover:bg-blood/5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold tracking-wider text-neutral-300">BOT ACCESS</span>
                  <span className="font-display text-sm font-bold text-white">$50</span>
                </div>
                <p className="mt-1 text-[10px] text-muted">Full access to Vending X bot</p>
                <span className="mt-2 inline-block font-display text-[8px] tracking-wider text-muted/40 transition group-hover:text-blood/70">GET ACCESS &rarr;</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .vx-neon {
          animation: vxNeonPulse 2.5s ease-in-out infinite alternate;
        }
        @keyframes vxNeonPulse {
          0%   { opacity: 1; }
          50%  { opacity: .92; }
          100% { opacity: 1; text-shadow: 0 0 10px rgba(230,0,0,.8), 0 0 30px rgba(230,0,0,.5), 0 0 60px rgba(230,0,0,.3), 0 0 100px rgba(230,0,0,.15); }
        }
        @keyframes vxShake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-4px) rotate(-.4deg); }
          30% { transform: translateX(4px) rotate(.4deg); }
          50% { transform: translateX(-3px); }
          70% { transform: translateX(3px) rotate(-.2deg); }
          90% { transform: translateX(-1px); }
        }
        .vx-shake { animation: vxShake .5s ease-in-out; }
        @keyframes vxSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vx-slide-up { animation: vxSlideUp .4s ease-out; }
        @keyframes vxLed {
          0%, 90% { opacity: 1; }
          95% { opacity: .4; }
          100% { opacity: 1; }
        }
        .vx-led { animation: vxLed 3s ease-in-out infinite; }
        .vx-led-tiny { animation: vxLed 4s ease-in-out infinite; }
        @keyframes vxLedGreen {
          0%, 80% { opacity: 1; box-shadow: 0 0 6px #00ff5e, 0 0 14px #00ff5e; }
          90% { opacity: .6; box-shadow: 0 0 3px #00ff5e; }
          100% { opacity: 1; box-shadow: 0 0 6px #00ff5e, 0 0 14px #00ff5e; }
        }
        .vx-led-green { animation: vxLedGreen 4s ease-in-out infinite; }
        @keyframes vxLcd {
          0%, 95% { opacity: 1; }
          96% { opacity: .85; }
          97% { opacity: 1; }
          98% { opacity: .9; }
          100% { opacity: 1; }
        }
        .vx-lcd { animation: vxLcd 5s step-end infinite; }
        @keyframes vxVendPulse {
          0% { box-shadow: 0 0 16px rgba(230,0,0,.15), inset 0 0 8px rgba(0,0,0,.5); }
          50% { box-shadow: 0 0 32px rgba(230,0,0,.3), inset 0 0 8px rgba(0,0,0,.5); }
          100% { box-shadow: 0 0 16px rgba(230,0,0,.15), inset 0 0 8px rgba(0,0,0,.5); }
        }
        .vx-vend-pulse { animation: vxVendPulse 1.5s ease-in-out infinite; }
        @keyframes vxSelected {
          0% { box-shadow: 0 0 20px rgba(230,0,0,.15); }
          50% { box-shadow: 0 0 28px rgba(230,0,0,.25); }
          100% { box-shadow: 0 0 20px rgba(230,0,0,.15); }
        }
        .vx-selected { animation: vxSelected 2s ease-in-out infinite; }
        @keyframes vxBadgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .8; }
        }
        .vx-premium-badge { animation: vxBadgePulse 3s ease-in-out infinite; }
        @keyframes vxDropping {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          20% { transform: translateY(12px) rotate(-2deg); opacity: .9; }
          100% { transform: translateY(90px) rotate(4deg); opacity: 0; }
        }
        .vx-dropping { animation: vxDropping .7s ease-in forwards; pointer-events: none; }
        @keyframes vxTrayPopup {
          0% { transform: translateY(40px) scale(0.3); opacity: 0; }
          35% { transform: translateY(-14px) scale(1.08); opacity: 1; }
          55% { transform: translateY(6px) scale(0.96); }
          75% { transform: translateY(-3px) scale(1.02); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .vx-tray-popup { animation: vxTrayPopup .65s cubic-bezier(.34, 1.56, .64, 1); }
        .vx-coil { transition: transform .3s ease; }
        button:hover .vx-coil { transform: translateX(-50%) scaleY(1.05); opacity: .3; }
        @media (prefers-reduced-motion: reduce) {
          .vx-shake, .vx-slide-up, .vx-neon, .vx-led, .vx-led-tiny, .vx-led-green,
          .vx-lcd, .vx-vend-pulse, .vx-selected, .vx-premium-badge,
          .vx-dropping, .vx-tray-popup { animation: none; }
        }
      `}</style>
    </section>
  );
}
