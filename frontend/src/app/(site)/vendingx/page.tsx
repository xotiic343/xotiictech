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

/* ── Constants ─────────────────────────────────────── */

const SLOT_IDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4"];
const POLL_MS = 15_000;

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
          <div className="mx-auto max-w-md border border-line bg-ink/80 p-10 text-center backdrop-blur-sm">
            <h1 className="font-display text-3xl font-black tracking-wider text-cyan"
                style={{ textShadow: "0 0 20px rgba(0,229,255,.5)" }}>
              VENDING X
            </h1>
            <p className="mt-4 text-sm text-muted">Log in with Discord to access the vending machine.</p>
            <a
              href="/vendingx/auth/login"
              className="btn-primary mt-8 inline-flex items-center gap-2"
              style={{ background: "#5865F2", boxShadow: "0 0 16px rgba(88,101,242,.35)" }}
            >
              <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor">
                <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9.2.2 0 0010.4 5C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0018-9v-.1c1.4-14.8-2.3-27.7-9.9-39.1a.2.2 0 00-.1-.1zM23.7 37.1c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.8 6.9-6.2 6.9zm22.9 0c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.7 6.9-6.2 6.9z"/>
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
          className="mb-8 text-center font-display text-4xl font-black tracking-[0.2em] text-cyan sm:text-5xl"
          style={{
            textShadow: "0 0 7px #00e5ff, 0 0 20px #00e5ff, 0 0 42px #00e5ff, 0 0 82px #7B2FF7, 0 0 120px #7B2FF7",
            animation: "neonPulse 2.5s ease-in-out infinite alternate",
          }}
        >
          VENDING X
        </h1>
      </Reveal>

      <div className="mx-auto max-w-3xl">
        {/* Machine body */}
        <div
          className={`border border-line bg-ink/90 p-5 backdrop-blur-sm transition-transform ${shaking ? "animate-shake" : ""}`}
          style={{ boxShadow: "0 0 0 1px rgba(0,229,255,.08), 0 20px 60px rgba(0,0,0,.6)" }}
        >
          {/* Glass panel */}
          <div className="relative overflow-hidden border border-line bg-black/60 p-4"
               style={{ backdropFilter: "blur(4px)" }}>
            {/* Glass reflection overlay */}
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,.05) 0%, transparent 40%)" }}
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
                    className={`relative flex min-h-[110px] flex-col items-center gap-1 border p-2 transition-all sm:p-3 ${
                      isSelected
                        ? "border-cyan bg-cyan/10 shadow-[0_0_20px_rgba(0,229,255,.2)]"
                        : soldOut
                        ? "cursor-not-allowed border-line/50 bg-black/40 opacity-40"
                        : "border-line bg-black/30 hover:border-cyan/60 hover:bg-cyan/5"
                    }`}
                  >
                    {/* LED */}
                    <span
                      className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                      style={{
                        background: soldOut ? "#ff2d2d" : "#00ff5e",
                        boxShadow: soldOut
                          ? "0 0 4px #ff2d2d"
                          : "0 0 6px #00ff5e, 0 0 12px #00ff5e",
                      }}
                    />
                    {/* Premium badge */}
                    {info?.premium && (
                      <span className="absolute left-1 top-1 rounded bg-purple-600 px-1 py-px text-[9px] font-bold text-white">
                        PREMIUM
                      </span>
                    )}
                    <span className="font-display text-[10px] font-bold tracking-wider text-cyan">{slotId}</span>
                    <span className="text-2xl leading-none">{info?.emoji || "📦"}</span>
                    <span className="text-center text-[10px] font-semibold leading-tight text-neutral-300 sm:text-xs">
                      {info?.name || "Empty"}
                    </span>
                    <span className="font-display text-[9px] text-dim">{info ? `${info.count} left` : "—"}</span>
                    {/* Cracked-glass overlay for sold out */}
                    {soldOut && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,0,0,.05) 8px, rgba(255,0,0,.05) 10px)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control panel */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border border-line bg-panel/60 p-4">
            {/* Coin slot */}
            <div className="flex flex-col items-center gap-1">
              <div className="h-1 w-9 rounded border border-edge bg-black/80" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,.6)" }} />
              <span className="font-display text-[8px] tracking-wider text-dim">INSERT COIN</span>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-1">
              {["A", "B", "C", "1", "2", "3", "4", "CLR"].map((k) => (
                <button
                  key={k}
                  onClick={() => handleKeypad(k)}
                  className={`flex h-8 w-9 items-center justify-center border border-line bg-panel font-display text-[11px] font-bold transition hover:border-cyan hover:bg-panel/80 active:translate-y-px sm:h-9 sm:w-10 ${
                    k === "CLR" ? "text-red-500" : "text-cyan"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* LCD display */}
            <div
              className="min-w-[150px] border border-green-900/60 bg-black px-3 py-2 text-center font-display text-xs tracking-wider text-green-400"
              style={{ textShadow: "0 0 8px #00ff5e", boxShadow: "inset 0 2px 6px rgba(0,0,0,.5)" }}
            >
              {lcd}
            </div>

            {/* VEND button */}
            <button
              onClick={doVend}
              disabled={!selected || vending}
              className="group relative h-20 w-20 rounded-full border-2 border-cyan/30 bg-panel p-1 transition hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed sm:h-24 sm:w-24"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,.5), 0 0 0 3px rgba(0,229,255,.15)" }}
            >
              <span
                className="flex h-full w-full items-center justify-center rounded-full bg-cyan font-display text-sm font-black tracking-wider text-black sm:text-base"
                style={{ boxShadow: "inset 0 2px 4px rgba(255,255,255,.3), inset 0 -2px 4px rgba(0,0,0,.2)" }}
              >
                VEND
              </span>
            </button>
          </div>

          {/* Dispensing tray */}
          <div className="mt-3 min-h-[40px] overflow-hidden border border-line bg-black/60">
            {dispensed && (
              <div className="animate-slide-up p-4">
                <div className="border border-cyan bg-ink/90 p-4" style={{ boxShadow: "0 0 20px rgba(0,229,255,.12)" }}>
                  <div className="mb-2 font-display text-sm tracking-wider text-cyan">
                    {dispensed.name}
                  </div>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-line bg-black/60 p-3 font-mono text-sm text-neutral-200">
                    {dispensed.item}
                  </pre>
                  <button
                    onClick={copyItem}
                    className="btn-ghost btn-sm mt-3"
                    style={copied ? { borderColor: "#22ff88", color: "#22ff88" } : {}}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <span className="ml-3 text-xs text-dim">Remaining: {dispensed.remaining}</span>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 text-center text-sm text-red-400">{error}</div>
            )}
          </div>
        </div>

        {/* User bar */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {user.avatar ? (
              <img
                src={`https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`}
                alt="" className="h-7 w-7 rounded-full border border-line"
              />
            ) : (
              <div className="h-7 w-7 rounded-full border border-line bg-panel" />
            )}
            <span className="font-semibold text-neutral-200">{user.username}</span>
            {user.has_access && (
              <span className="rounded bg-purple-600/80 px-1.5 py-0.5 font-display text-[9px] font-bold tracking-wider text-white">
                PREMIUM
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dim">{totalStock} items in stock</span>
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

      {/* Inline styles for animations */}
      <style>{`
        @keyframes neonPulse {
          0%   { opacity: 1; }
          50%  { opacity: .92; }
          100% { opacity: 1; text-shadow: 0 0 10px #00e5ff, 0 0 30px #00e5ff, 0 0 60px #00e5ff, 0 0 100px #7B2FF7, 0 0 140px #7B2FF7; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-3px) rotate(-.3deg); }
          30% { transform: translateX(3px) rotate(.3deg); }
          50% { transform: translateX(-2px); }
          70% { transform: translateX(2px) rotate(-.2deg); }
          90% { transform: translateX(-1px); }
        }
        .animate-shake { animation: shake .5s ease-in-out; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp .4s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .animate-shake, .animate-slide-up { animation: none; }
        }
      `}</style>
    </section>
  );
}
