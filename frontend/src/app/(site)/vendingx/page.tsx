"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/fx/Reveal";

/* ── Types ─────────────────────────────────────────── */

interface StockItem {
  name: string;
  emoji: string;
  description: string;
  count: number;
  premium: boolean;
}

interface User {
  user_id: number;
  username: string;
  avatar: string;
  is_owner: boolean;
  has_access: boolean;
}

interface VendResult {
  item: string;
  stock_type: string;
  name: string;
  remaining: number;
}

interface FeedEntry {
  username: string;
  category: string;
  emoji: string;
  source: string;
  time: string;
}

/* ── SVG icons by category keyword ────────────────── */

const ICONS: Record<string, JSX.Element> = {
  nitro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  token: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <circle cx="8" cy="15" r="4" /><path d="M12 12l8-8m0 0h-4m4 0v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <rect x="3" y="8" width="18" height="13" rx="1" /><path d="M12 8v13M3 12h18M7.5 8C6 6.5 6 4.5 7.5 3S11 2 12 4c1-2 3-2.5 4.5-1S18 6.5 16.5 8" strokeLinecap="round" />
    </svg>
  ),
  game: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <rect x="2" y="6" width="20" height="12" rx="3" /><circle cx="16" cy="12" r="1.5" fill="currentColor" /><path d="M8 10v4M6 12h4" strokeLinecap="round" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.8 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.8-1.7" strokeLinecap="round" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <path d="M12 2l3 6.2 6.8 1-4.9 4.8L18.1 21 12 17.7 5.9 21l1.2-7L2.2 9.2l6.8-1z" strokeLinejoin="round" />
    </svg>
  ),
  credit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" strokeLinecap="round" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  music: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M9 18V5l12-2v13" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <path d="M12 2l8 4v5c0 5.5-3.8 9.7-8 11-4.2-1.3-8-5.5-8-11V6l8-4z" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v4m0 4h.01" strokeLinecap="round" />
    </svg>
  ),
};

function slotIcon(name: string): JSX.Element {
  const n = name.toLowerCase();
  for (const [key, icon] of Object.entries(ICONS)) {
    if (key !== "default" && n.includes(key)) return icon;
  }
  return ICONS.default;
}

/* ── Constants ─────────────────────────────────────── */

const SLOT_IDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4"];
const POLL_MS = 15_000;
const FEED_POLL_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Page ──────────────────────────────────────────── */

export default function VendingXPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stock, setStock] = useState<Record<string, StockItem>>({});
  const [selected, setSelected] = useState<{ slotId: string; type: string } | null>(null);
  const [lcd, setLcd] = useState("SELECT A SLOT");
  const [vending, setVending] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [dispensed, setDispensed] = useState<VendResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const keyBuf = useRef("");

  /* ── Auth check ──────────────────────────────────── */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      document.cookie = `vx_session=${token}; path=/; secure; samesite=lax; max-age=86400`;
      window.history.replaceState({}, "", window.location.pathname);
    }
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/vendingx/auth/me", { credentials: "include" });
      if (res.ok) setUser(await res.json());
    } catch { /* not logged in */ }
  }

  /* ── Stock polling ───────────────────────────────── */

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

  /* ── Live feed polling ──────────────────────────── */

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/vendingx/api/feed");
      if (res.ok) setFeed(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, FEED_POLL_MS);
    return () => clearInterval(id);
  }, [fetchFeed]);

  /* ── Keyboard handler ────────────────────────────── */

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
      } else if (k === "ENTER" && selected) {
        doVend();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── Vend ────────────────────────────────────────── */

  async function doVend() {
    if (vending || !selected) return;
    setVending(true);
    setDispensed(null);
    setError("");
    setLcd("VENDING...");

    setShaking(true);
    await sleep(500);
    setShaking(false);

    try {
      const res = await fetch("/vendingx/api/vend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stock_type: selected.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLcd(data.error || "ERROR");
        setError(data.error || "Vend failed");
      } else {
        setLcd(`DISPENSED: ${data.name}`);
        setDispensed(data);
        await fetchStock();
        await fetchFeed();
      }
    } catch {
      setLcd("NETWORK ERROR");
      setError("Network error");
    }
    setVending(false);
  }

  async function copyItem() {
    if (!dispensed) return;
    await navigator.clipboard.writeText(dispensed.item);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ── Helpers ─────────────────────────────────────── */

  function selectSlot(slotId: string, typeKey: string, info: StockItem) {
    if (info.count === 0) return;
    setSelected({ slotId, type: typeKey });
    setLcd(`${slotId}: ${info.name}`);
    setDispensed(null);
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

  /* ── AUTH GATE ───────────────────────────────────── */

  if (!user) {
    return (
      <section className="container-x flex min-h-[70vh] items-center justify-center py-20">
        <Reveal>
          <div className="card corner-brackets mx-auto max-w-md p-10 text-center">
            <h1
              className="font-display text-4xl font-black tracking-[0.2em] text-blood"
              style={{ textShadow: "0 0 20px rgba(230,0,0,.5), 0 0 60px rgba(230,0,0,.2)" }}
            >
              VENDING X
            </h1>
            <p className="mt-4 text-sm text-muted">Log in with Discord to access the vending machine.</p>
            <a
              href="/vendingx/auth/login"
              className="btn-primary mt-8 inline-flex items-center gap-2"
              style={{ background: "#5865F2", boxShadow: "0 0 16px rgba(88,101,242,.35)" }}
            >
              <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor">
                <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9.2.2 0 0010.4 5C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0018-9v-.1c1.4-14.8-2.3-27.7-9.9-39.1a.2.2 0 00-.1-.1zM23.7 37.1c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.8 6.9-6.2 6.9zm22.9 0c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.7 6.9-6.2 6.9z" />
              </svg>
              Login with Discord
            </a>
          </div>
        </Reveal>
      </section>
    );
  }

  /* ── MAIN MACHINE ────────────────────────────────── */

  return (
    <section className="container-x py-12">
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
        {/* ─── Machine body ────────────────────────── */}
        <div>
          <div
            className={`relative overflow-hidden border-2 border-crimson/40 transition-transform ${shaking ? "vx-shake" : ""}`}
            style={{
              background: "linear-gradient(180deg, #1a0000 0%, #0a0a0a 30%, #0d0000 100%)",
              boxShadow: "0 0 0 1px rgba(230,0,0,.08), 0 0 40px rgba(230,0,0,.06), 0 20px 60px rgba(0,0,0,.8)",
            }}
          >
            {/* Top metal strip */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ background: "linear-gradient(180deg, #2a0a0a, #1a0505)" }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blood" style={{ boxShadow: "0 0 6px rgba(230,0,0,.6)" }} />
                <span className="font-display text-[10px] tracking-[0.3em] text-blood/70">VENDING X</span>
              </div>
              <span className="font-display text-[9px] tracking-wider text-dim">by XotiicTech</span>
            </div>

            {/* Glass panel */}
            <div className="relative m-3 overflow-hidden border border-crimson/20 bg-black/80 p-3 sm:p-4">
              {/* Glass reflections */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,.04) 0%, transparent 35%), linear-gradient(225deg, rgba(230,0,0,.02) 0%, transparent 50%)",
                }}
              />
              <div
                className="pointer-events-none absolute -right-20 -top-20 z-10 h-40 w-40 rotate-45 opacity-[.03]"
                style={{ background: "radial-gradient(circle, white, transparent 70%)" }}
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
                      className={`group relative flex min-h-[120px] flex-col items-center justify-center gap-1.5 border p-2 transition-all sm:p-3 ${
                        isSelected
                          ? "border-blood bg-blood/10 shadow-[0_0_20px_rgba(230,0,0,.15)]"
                          : soldOut
                          ? "cursor-not-allowed border-line/30 bg-black/60 opacity-30"
                          : "border-line/60 bg-black/40 hover:border-crimson/60 hover:bg-blood/5"
                      }`}
                    >
                      {/* LED indicator */}
                      <span
                        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                        style={{
                          background: soldOut ? "#ff2d2d" : "#00ff5e",
                          boxShadow: soldOut ? "0 0 4px #ff2d2d" : "0 0 6px #00ff5e, 0 0 12px #00ff5e",
                        }}
                      />
                      {/* Premium badge */}
                      {info?.premium && (
                        <span
                          className="absolute left-1 top-1 border border-blood/60 bg-blood/80 px-1 py-px font-display text-[8px] font-bold tracking-wider text-white"
                          style={{ boxShadow: "0 0 6px rgba(230,0,0,.3)" }}
                        >
                          PREMIUM
                        </span>
                      )}
                      {/* Slot ID */}
                      <span className="font-display text-[10px] font-bold tracking-wider text-blood">{slotId}</span>
                      {/* Icon */}
                      <span className={`${isSelected ? "text-blood" : "text-neutral-500 group-hover:text-neutral-400"} transition-colors`}>
                        {info ? slotIcon(info.name) : ICONS.default}
                      </span>
                      {/* Name */}
                      <span className="text-center text-[10px] font-semibold leading-tight text-neutral-300 sm:text-xs">
                        {info?.name || "Empty"}
                      </span>
                      {/* Stock count */}
                      <span className="font-display text-[9px] text-dim">{info ? `${info.count} left` : "—"}</span>
                      {/* Sold-out overlay */}
                      {soldOut && (
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(230,0,0,.04) 6px, rgba(230,0,0,.04) 8px)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Control panel */}
            <div
              className="mx-3 mb-3 flex flex-wrap items-center justify-center gap-4 border border-crimson/20 p-4"
              style={{ background: "linear-gradient(180deg, #180505, #0f0202)" }}
            >
              {/* Coin slot */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="h-1 w-10 border border-crimson/30 bg-black/80"
                  style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,.8), 0 0 4px rgba(230,0,0,.1)" }}
                />
                <span className="font-display text-[7px] tracking-[0.2em] text-blood/40">INSERT COIN</span>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-4 gap-1">
                {["A", "B", "C", "1", "2", "3", "4", "CLR"].map((k) => (
                  <button
                    key={k}
                    onClick={() => handleKeypad(k)}
                    className={`flex h-9 w-10 items-center justify-center border font-display text-[11px] font-bold transition active:translate-y-px ${
                      k === "CLR"
                        ? "border-red-900/60 bg-red-950/40 text-red-400 hover:bg-red-950/60"
                        : "border-crimson/30 bg-black/60 text-blood hover:border-crimson/60 hover:bg-blood/10"
                    }`}
                    style={{ boxShadow: "inset 0 -1px 2px rgba(0,0,0,.4)" }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* LCD display */}
              <div
                className="min-w-[160px] border border-crimson/30 bg-black px-3 py-2.5 text-center font-display text-xs tracking-wider"
                style={{
                  color: "#ff3333",
                  textShadow: "0 0 8px rgba(230,0,0,.6)",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,.7), 0 0 4px rgba(230,0,0,.05)",
                }}
              >
                {lcd}
              </div>

              {/* VEND button */}
              <button
                onClick={doVend}
                disabled={!selected || vending}
                className="group relative h-20 w-20 rounded-full p-1 transition hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed sm:h-24 sm:w-24"
                style={{
                  background: "linear-gradient(145deg, #2a0000, #1a0000)",
                  boxShadow: "0 4px 16px rgba(0,0,0,.7), 0 0 0 2px rgba(230,0,0,.2), 0 0 20px rgba(230,0,0,.08)",
                }}
              >
                <span
                  className="flex h-full w-full items-center justify-center rounded-full font-display text-sm font-black tracking-[0.2em] text-white sm:text-base"
                  style={{
                    background: "linear-gradient(145deg, #cc0000, #8b0000)",
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,.15), inset 0 -2px 4px rgba(0,0,0,.3), 0 0 12px rgba(230,0,0,.3)",
                  }}
                >
                  VEND
                </span>
              </button>
            </div>

            {/* Dispensing tray */}
            <div
              className="mx-3 mb-3 min-h-[44px] overflow-hidden border border-crimson/20 bg-black/70"
              style={{ boxShadow: "inset 0 4px 12px rgba(0,0,0,.6)" }}
            >
              {dispensed && (
                <div className="vx-slide-up p-4">
                  <div className="border border-blood/40 bg-blood/5 p-4" style={{ boxShadow: "0 0 20px rgba(230,0,0,.08)" }}>
                    <div className="mb-2 font-display text-sm tracking-wider text-blood">
                      {dispensed.name}
                    </div>
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-line bg-black/60 p-3 font-mono text-sm text-neutral-200">
                      {dispensed.item}
                    </pre>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={copyItem}
                        className="btn-ghost btn-sm"
                        style={copied ? { borderColor: "#e60000", color: "#e60000" } : {}}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                      <span className="text-xs text-dim">Remaining: {dispensed.remaining}</span>
                    </div>
                  </div>
                </div>
              )}
              {error && <div className="p-3 text-center text-sm text-red-400">{error}</div>}
            </div>

            {/* Bottom strip */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ background: "linear-gradient(180deg, #1a0505, #0f0202)" }}
            >
              <span className="text-[10px] text-dim">{totalStock} items in stock</span>
              <span className="text-[9px] tracking-wider text-blood/30">
                <span className="text-crimson">&#9632;</span> POWERED BY XOTIICTECH
              </span>
            </div>
          </div>

          {/* User bar */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`}
                  alt="" className="h-7 w-7 rounded-full border border-line"
                />
              ) : (
                <div className="h-7 w-7 rounded-full border border-line bg-panel" />
              )}
              <span className="font-semibold text-neutral-200">{user.username}</span>
              {user.has_access && (
                <span
                  className="border border-blood/60 bg-blood/20 px-1.5 py-0.5 font-display text-[9px] font-bold tracking-wider text-blood"
                  style={{ boxShadow: "0 0 6px rgba(230,0,0,.15)" }}
                >
                  PREMIUM
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user.is_owner && (
                <a href="/vendingx/admin" className="btn-ghost btn-sm">Admin</a>
              )}
              <button
                onClick={async () => {
                  await fetch("/vendingx/auth/logout", { method: "POST", credentials: "include" });
                  setUser(null);
                }}
                className="btn-ghost btn-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* ─── Live Feed ───────────────────────────── */}
        <aside className="hidden lg:block">
          <div className="card sticky top-20 max-h-[calc(100vh-8rem)] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blood" style={{ boxShadow: "0 0 6px rgba(230,0,0,.5)" }} />
              <span className="font-display text-xs font-bold tracking-[0.15em] text-blood">LIVE FEED</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 12rem)" }}>
              {feed.length === 0 ? (
                <div className="p-4 text-center text-xs text-dim">No vends yet</div>
              ) : (
                <ul className="divide-y divide-line/50">
                  {feed.map((f, i) => (
                    <li key={`${f.time}-${i}`} className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className="shrink-0 text-blood/60">{slotIcon(f.category)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-neutral-200">{f.username}</div>
                        <div className="truncate text-[10px] text-muted">
                          {f.category}
                          <span className="ml-1 text-dim">via {f.source}</span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-dim">{timeAgo(f.time)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile feed (below machine) */}
        <div className="lg:hidden">
          <div className="card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blood" style={{ boxShadow: "0 0 6px rgba(230,0,0,.5)" }} />
              <span className="font-display text-xs font-bold tracking-[0.15em] text-blood">LIVE FEED</span>
            </div>
            {feed.length === 0 ? (
              <div className="p-4 text-center text-xs text-dim">No vends yet</div>
            ) : (
              <ul className="divide-y divide-line/50">
                {feed.slice(0, 8).map((f, i) => (
                  <li key={`m-${f.time}-${i}`} className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="shrink-0 text-blood/60">{slotIcon(f.category)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-neutral-200">{f.username}</div>
                      <div className="truncate text-[10px] text-muted">{f.category}</div>
                    </div>
                    <span className="shrink-0 text-[10px] text-dim">{timeAgo(f.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Inline keyframe styles */}
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
          10% { transform: translateX(-3px) rotate(-.3deg); }
          30% { transform: translateX(3px) rotate(.3deg); }
          50% { transform: translateX(-2px); }
          70% { transform: translateX(2px) rotate(-.2deg); }
          90% { transform: translateX(-1px); }
        }
        .vx-shake { animation: vxShake .5s ease-in-out; }
        @keyframes vxSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vx-slide-up { animation: vxSlideUp .4s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .vx-shake, .vx-slide-up, .vx-neon { animation: none; }
        }
      `}</style>
    </section>
  );
}
