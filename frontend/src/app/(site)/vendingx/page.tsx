"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StockIcon } from "@/components/vendingx/StockIcon";

/* ── Types ── */

type StockEntry = { name: string; description: string; count: number; premium: boolean; icon: string | null };
type Item = StockEntry & { key: string; slot: string };
type Me = {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  premium: boolean;
  inServer: boolean;
};
type Tier = "free" | "premium";
type Phase = "idle" | "processing" | "dropping" | "landed" | "open";
type Drop = { item: Item; x: number; y: number; w: number; h: number; dx: number; dy: number };
type Notice = { text: string; login?: boolean } | null;

/* ── Constants ── */

const COLS = 4;
const MIN_ROWS = 3;
const POLL_MS = 20_000;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/xotiictech";
const LOGIN_URL = "/support/api/auth/signin?callbackUrl=/vendingx";
const DROP_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (s: string) => s.toUpperCase().slice(0, 13);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/* ── Small graphics ── */

function DiscordGlyph({ className = "h-3 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 71 55" fill="currentColor" className={className} aria-hidden>
      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9.2.2 0 0010.4 5C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0018-9v-.1c1.4-14.8-2.3-27.7-9.9-39.1a.2.2 0 00-.1-.1zM23.7 37.1c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.8 6.9-6.2 6.9zm22.9 0c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.7 6.9-6.2 6.9z" />
    </svg>
  );
}

function LockGlyph({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className} aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-2.5 w-2.5 rounded-full ${className}`}
      style={{
        background: "radial-gradient(circle at 35% 30%, #9a9ca3, #3a3b40 55%, #111 100%)",
        boxShadow: "inset 0 -1px 1px rgba(0,0,0,.7), 0 1px 1px rgba(255,255,255,.08)",
      }}
    >
      <span className="absolute left-1/2 top-1/2 h-px w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-[35deg] bg-black/70" />
    </span>
  );
}

/** Front view of a spiral coil. Spinning animates the wire around the loops, like the coil turning. */
function Coil({ spinning, dim }: { spinning: boolean; dim: boolean }) {
  const loops = [
    { cy: 7, rx: 21, ry: 5, w: 1.3, o: 0.35 },
    { cy: 9.5, rx: 25, ry: 6, w: 1.7, o: 0.6 },
    { cy: 12, rx: 29, ry: 7, w: 2.2, o: 1 },
  ];
  return (
    <svg viewBox="0 0 64 21" className="relative -mt-[9px] h-[15px] w-[50px] sm:h-[19px] sm:w-[64px]" aria-hidden>
      {loops.map((l, i) => (
        <ellipse
          key={i}
          cx="32"
          cy={l.cy}
          rx={l.rx}
          ry={l.ry}
          fill="none"
          stroke="url(#vx-metal)"
          strokeWidth={l.w}
          strokeLinecap="round"
          strokeDasharray="30 8"
          opacity={dim ? l.o * 0.45 : l.o}
          className={spinning ? "vx-coil-turn" : undefined}
          style={{ animationDelay: `${i * -0.08}s` }}
        />
      ))}
    </svg>
  );
}

/** A packaged product: crimped seal, glossy wrapper, icon and label. */
function Package({ item }: { item: Pick<Item, "key" | "name" | "icon" | "premium"> }) {
  return (
    <div
      className="relative flex h-[60px] w-[46px] flex-col items-center justify-between overflow-hidden rounded-[5px] px-1 pb-1 pt-2 sm:h-[84px] sm:w-[64px]"
      style={{
        background: item.premium
          ? "linear-gradient(160deg,#6b1010 0%,#330606 42%,#160202 100%)"
          : "linear-gradient(160deg,#34363d 0%,#191a1f 42%,#0b0b0d 100%)",
        border: `1px solid ${item.premium ? "rgba(255,90,90,.28)" : "rgba(255,255,255,.09)"}`,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.2), inset 0 -12px 18px rgba(0,0,0,.55), inset 1px 0 0 rgba(255,255,255,.06), 0 10px 14px -6px rgba(0,0,0,.9)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[5px]"
        style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 2px, rgba(0,0,0,.35) 2px 4px)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/2 -skew-x-12"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.13), transparent)" }}
      />
      <span className={`relative mt-1 ${item.premium ? "text-[#ff7070]" : "text-neutral-100"} drop-shadow-[0_0_8px_rgba(255,50,50,.35)]`}>
        <StockIcon icon={item.icon} stockKey={item.key} name={item.name} className="h-6 w-6 sm:h-9 sm:w-9" />
      </span>
      <span className="relative w-full truncate text-center font-display text-[5.5px] font-bold uppercase tracking-wider text-white/85 sm:text-[7px]">
        {item.name}
      </span>
    </div>
  );
}

function Slot({
  code,
  item,
  selected,
  spinning,
  advance,
  disabled,
  pkgRef,
  onPick,
}: {
  code: string;
  item?: Item;
  selected: boolean;
  spinning: boolean;
  advance: number;
  disabled: boolean;
  pkgRef: (el: HTMLDivElement | null) => void;
  onPick: () => void;
}) {
  const count = item?.count ?? 0;
  const label = item ? `${code}: ${item.name}, ${count ? `${count} left` : "sold out"}` : `${code}: empty`;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      className="group relative flex h-[92px] flex-col items-center justify-end outline-none sm:h-[122px]"
    >
      {selected && (
        <span
          aria-hidden
          className="vx-select absolute inset-x-0 bottom-0 top-1 rounded-md"
          style={{ background: "radial-gradient(60% 55% at 50% 70%, rgba(255,40,40,.28), transparent 70%)" }}
        />
      )}
      {item && count > 0 && (
        <div className="relative flex items-end justify-center">
          {count > 2 && (
            <div className="absolute bottom-[7px] left-1/2 -translate-x-1/2 scale-[.8] opacity-30 brightness-50">
              <Package item={item} />
            </div>
          )}
          {count > 1 && (
            <div className="absolute bottom-[4px] left-1/2 -translate-x-1/2 scale-[.9] opacity-60 brightness-75">
              <Package item={item} />
            </div>
          )}
          <div
            ref={pkgRef}
            key={advance}
            className={`relative transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 ${
              advance ? "vx-advance" : ""
            } ${selected ? "-translate-y-1" : ""}`}
          >
            <Package item={item} />
          </div>
        </div>
      )}
      {item && count === 0 && (
        <span className="mb-2 font-display text-[7px] tracking-[0.25em] text-red-500/70 sm:text-[8px]">SOLD OUT</span>
      )}
      <Coil spinning={spinning} dim={!item || count === 0} />
    </button>
  );
}

function Rail({ codes, bySlot, selected }: { codes: string[]; bySlot: Record<string, Item>; selected: string | null }) {
  return (
    <div
      className="relative mx-1 grid h-[17px] grid-cols-4 gap-1 rounded-[2px] px-2 sm:h-[20px] sm:gap-2 sm:px-3"
      style={{
        background: "linear-gradient(180deg,#5a5d66 0%,#25262b 30%,#101114 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 8px 12px rgba(0,0,0,.75)",
      }}
    >
      {codes.map((code) => {
        const it = bySlot[code];
        const on = !!it && it.count > 0;
        return (
          <div key={code} className="flex items-center justify-center gap-1">
            <span
              className={`rounded-[2px] px-1 font-display text-[7px] leading-[11px] ring-1 sm:text-[8px] ${
                selected === code ? "bg-[#ff2a2a] text-black ring-[#ff7070]" : "bg-black/80 text-white/85 ring-white/10"
              }`}
            >
              {code}
            </span>
            {it && (
              <>
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{
                    background: on ? "#2bff6b" : "#ff2d2d",
                    boxShadow: on ? "0 0 5px #2bff6b" : "0 0 5px #ff2d2d",
                  }}
                />
                <span className="hidden font-mono text-[8px] text-white/55 sm:inline">{it.count}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ── */

export default function VendingXPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [stock, setStock] = useState<Record<string, StockEntry> | null>(null);
  const [offline, setOffline] = useState(false);
  const [tier, setTier] = useState<Tier>("free");
  const [selected, setSelected] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [lcd, setLcd] = useState<[string, string]>(["WELCOME", "LOADING..."]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [drop, setDrop] = useState<Drop | null>(null);
  const [prize, setPrize] = useState<{ item: Item; content: string } | null>(null);
  const [advance, setAdvance] = useState<{ slot: string; n: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [thud, setThud] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const machineRef = useRef<HTMLDivElement>(null);
  const binRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const pkgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /* ── Data ── */

  useEffect(() => {
    fetch("/vendingx/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: Me | null }) => setMe(d.user))
      .catch(() => setMe(null))
      .finally(() => setMeLoaded(true));
  }, []);

  const loadStock = useCallback(async () => {
    try {
      const r = await fetch("/vendingx/api/stock", { cache: "no-store" });
      if (!r.ok) throw new Error("offline");
      setStock(await r.json());
      setOffline(false);
    } catch {
      setOffline(true);
      setStock((s) => s ?? {});
    }
  }, []);

  useEffect(() => {
    loadStock();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadStock();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loadStock]);

  /* ── Derived ── */

  const locked = tier === "premium" && !me?.premium;

  const items = useMemo<Item[]>(() => {
    if (!stock || locked) return [];
    return Object.entries(stock)
      .filter(([, s]) => s.premium === (tier === "premium"))
      .map(([key, s], i) => ({ ...s, key, slot: `${LETTERS[Math.floor(i / COLS)]}${(i % COLS) + 1}` }));
  }, [stock, tier, locked]);

  const rows = Math.max(MIN_ROWS, Math.ceil(items.length / COLS));
  const rowLetters = LETTERS.slice(0, rows).split("");
  const bySlot = useMemo(() => Object.fromEntries(items.map((i) => [i.slot, i])), [items]);
  const selectedItem = selected ? bySlot[selected] : undefined;

  const totals = useMemo(() => {
    let free = 0;
    let premium = 0;
    for (const s of Object.values(stock ?? {})) {
      if (s.premium) premium += s.count;
      else free += s.count;
    }
    return { free, premium };
  }, [stock]);

  /* ── LCD idle text ── */

  useEffect(() => {
    if (phase !== "idle" || selected || entry) return;
    if (!stock) setLcd(["WELCOME", "LOADING..."]);
    else if (offline) setLcd(["OFFLINE", "TRY AGAIN SOON"]);
    else if (locked) setLcd(["PREMIUM SHELF", me ? "ROLE REQUIRED" : "LOGIN REQUIRED"]);
    else if (!items.length) setLcd(["RESTOCKING", "CHECK BACK SOON"]);
    else setLcd([tier === "premium" ? "PREMIUM SHELF" : "FREE SHELF", "SELECT AN ITEM"]);
  }, [phase, selected, entry, stock, offline, locked, me, items.length, tier]);

  /* ── Selection ── */

  function choose(slot: string) {
    if (phase !== "idle") return;
    setNotice(null);
    setEntry("");
    const it = bySlot[slot];
    if (!it) {
      setSelected(null);
      setLcd([slot, "EMPTY SLOT"]);
      return;
    }
    if (!it.count) {
      setSelected(null);
      setLcd([`${slot} ${short(it.name)}`, "SOLD OUT"]);
      return;
    }
    setSelected(slot);
    setLcd([`${slot} ${short(it.name)}`, `${it.count} LEFT - PRESS VEND`]);
  }

  function clearSelection() {
    setEntry("");
    setSelected(null);
    setNotice(null);
  }

  function press(key: string) {
    if (phase !== "idle") return;
    if (key === "CLR") return clearSelection();
    if (/^[A-Z]$/.test(key)) {
      if (!rowLetters.includes(key)) {
        setLcd([`ROW ${key}`, "NO SUCH ROW"]);
        return;
      }
      setSelected(null);
      setEntry(key);
      setLcd([`${key}_`, "ENTER NUMBER 1-4"]);
      return;
    }
    if (!entry) {
      setLcd(["PICK A ROW", "LETTER FIRST"]);
      return;
    }
    choose(`${entry}${key}`);
  }

  function switchTier(t: Tier) {
    if (phase !== "idle" || t === tier) return;
    setTier(t);
    clearSelection();
  }

  /* ── Vending ── */

  async function vend() {
    if (phase !== "idle") return;
    if (!selectedItem) {
      setLcd(["NO ITEM", "SELECT A SLOT"]);
      return;
    }
    if (!me) {
      setLcd(["LOGIN", "REQUIRED"]);
      setNotice({ text: "Log in with Discord to vend.", login: true });
      return;
    }

    const item = selectedItem;
    setNotice(null);
    setPhase("processing");
    setLcd([`${item.slot} ${short(item.name)}`, "VENDING..."]);
    const minSpin = sleep(reducedMotion.current ? 0 : 950);

    let data: { content?: string; remaining?: number; error?: string } = {};
    let ok = false;
    try {
      const r = await fetch("/vendingx/api/vend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stock_key: item.key }),
      });
      data = await r.json().catch(() => ({}));
      ok = r.ok;
      if (r.status === 401) setMe(null);
      if (r.status === 410) loadStock();
    } catch {
      data = { error: "Could not reach the machine" };
    }
    await minSpin;

    if (!ok || !data.content) {
      const msg = data.error || "Vend failed";
      setPhase("idle");
      setSelected(null);
      setLcd(["ERROR", short(msg)]);
      setNotice({ text: msg, login: msg.toLowerCase().includes("log in") });
      return;
    }

    setPrize({ item, content: data.content });
    setStock((prev) =>
      prev && prev[item.key] && typeof data.remaining === "number"
        ? { ...prev, [item.key]: { ...prev[item.key], count: data.remaining } }
        : prev,
    );
    setAdvance((a) => ({ slot: item.slot, n: (a?.n ?? 0) + 1 }));
    setLcd(["DISPENSING", "PLEASE WAIT"]);

    const m = machineRef.current?.getBoundingClientRect();
    const p = pkgRefs.current[item.slot]?.getBoundingClientRect();
    const b = binRef.current?.getBoundingClientRect();
    if (reducedMotion.current || !m || !p || !b) {
      setPhase("landed");
      setLcd(["THANK YOU", "PUSH FLAP TO COLLECT"]);
      return;
    }
    // Falls straight down off the coil, tumbles 90° and lands on its side in the pickup bin.
    const startCx = p.left + p.width / 2;
    const landCx = clamp(startCx, b.left + p.height / 2 + 10, b.right - p.height / 2 - 10);
    const landCy = b.bottom - 8 - p.width / 2;
    setDrop({
      item,
      x: p.left - m.left,
      y: p.top - m.top,
      w: p.width,
      h: p.height,
      dx: landCx - startCx,
      dy: landCy - (p.top + p.height / 2),
    });
    setPhase("dropping");
  }

  useEffect(() => {
    const el = dropRef.current;
    if (!drop || !el) return;
    const { dx, dy } = drop;
    const anim = el.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(1)", offset: 0, easing: "ease-out" },
        { transform: "translate(0,8px) rotate(-16deg) scale(1.07)", offset: 0.14, easing: "cubic-bezier(.55,0,1,.45)" },
        { transform: `translate(${dx}px,${dy}px) rotate(92deg) scale(1)`, offset: 0.7, easing: "cubic-bezier(.2,.65,.45,1)" },
        { transform: `translate(${dx}px,${dy - 20}px) rotate(99deg) scale(1)`, offset: 0.8, easing: "cubic-bezier(.55,0,1,.45)" },
        { transform: `translate(${dx}px,${dy}px) rotate(90deg) scale(1)`, offset: 0.9, easing: "ease-out" },
        { transform: `translate(${dx}px,${dy - 4}px) rotate(91deg) scale(1)`, offset: 0.95 },
        { transform: `translate(${dx}px,${dy}px) rotate(90deg) scale(1)`, offset: 1 },
      ],
      { duration: DROP_MS, fill: "forwards" },
    );
    const hit = setTimeout(() => {
      setThud(true);
      setTimeout(() => setThud(false), 260);
    }, DROP_MS * 0.7);
    anim.onfinish = () => {
      setPhase("landed");
      setLcd(["THANK YOU", "PUSH FLAP TO COLLECT"]);
    };
    return () => {
      clearTimeout(hit);
      anim.onfinish = null;
    };
  }, [drop]);

  function openFlap() {
    if (phase !== "landed") return;
    setPhase("open");
    setLcd(["ENJOY", "COME BACK SOON"]);
  }

  function finish() {
    setPhase("idle");
    setPrize(null);
    setDrop(null);
    setSelected(null);
    setCopied(false);
  }

  async function copyPrize() {
    if (!prize) return;
    try {
      await navigator.clipboard.writeText(prize.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  /* ── Keyboard ── */

  const keys = useRef({ press, vend, openFlap, finish, phase });
  useEffect(() => {
    keys.current = { press, vend, openFlap, finish, phase };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const k = e.key.toUpperCase();
      const h = keys.current;
      if (k === "ENTER") {
        if (h.phase === "landed") h.openFlap();
        else if (h.phase === "idle") h.vend();
        else return;
      } else if (k === "ESCAPE") {
        if (h.phase === "open") h.finish();
        else h.press("CLR");
      } else if (/^[A-Z1-4]$/.test(k)) {
        h.press(k);
      } else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    try {
      const { csrfToken } = await fetch("/support/api/auth/csrf").then((r) => r.json());
      const form = new FormData();
      form.append("csrfToken", csrfToken);
      form.append("callbackUrl", "/vendingx");
      await fetch("/support/api/auth/signout", { method: "POST", body: form });
    } finally {
      window.location.reload();
    }
  }

  const busy = phase !== "idle";
  const spinningSlot = phase === "processing" || phase === "dropping" ? selected : null;
  const keypad = [...rowLetters, "1", "2", "3", "4"];

  /* ── Render ── */

  return (
    <section className="container-x py-10">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="vx-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".4" stopColor="#a3a6ae" />
            <stop offset="1" stopColor="#2f3136" />
          </linearGradient>
        </defs>
      </svg>

      {/* Account bar */}
      <div className="mx-auto mb-8 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <span className="font-display text-[11px] uppercase tracking-[0.3em] text-blood">Vending X</span>
        {!meLoaded ? (
          <span className="h-7 w-40 animate-pulse bg-panel" />
        ) : me ? (
          <div className="flex items-center gap-3">
            {me.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://cdn.discordapp.com/avatars/${me.discordId}/${me.avatar}.png?size=64`}
                alt=""
                className="h-7 w-7 rounded-full border border-line"
              />
            ) : (
              <span className="h-7 w-7 rounded-full border border-line bg-panel" />
            )}
            <span className="text-xs uppercase tracking-wider text-muted">{me.globalName || me.username}</span>
            {me.premium ? (
              <span className="border border-blood/70 bg-blood/20 px-1.5 py-0.5 font-display text-[9px] font-bold tracking-widest text-blood">
                PREMIUM
              </span>
            ) : (
              <span className="border border-line px-1.5 py-0.5 font-display text-[9px] tracking-widest text-dim">FREE</span>
            )}
            <button onClick={logout} className="btn-ghost btn-sm">
              Log out
            </button>
          </div>
        ) : (
          <a href={LOGIN_URL} className="btn-primary btn-sm inline-flex items-center gap-2">
            <DiscordGlyph /> Login with Discord
          </a>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ─── Machine ─── */}
        <div className="mx-auto w-full max-w-[780px]">
          <div
            ref={machineRef}
            className={`relative isolate rounded-[22px] p-2.5 sm:p-4 ${thud ? "vx-thud" : ""} ${phase === "processing" ? "vx-hum" : ""}`}
            style={{
              background: "linear-gradient(180deg,#470a0a 0%,#260505 16%,#160303 62%,#240505 100%)",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,.14), inset 0 -4px 0 rgba(0,0,0,.6), inset 4px 0 8px rgba(255,255,255,.05), inset -4px 0 8px rgba(0,0,0,.55), 0 50px 90px -30px rgba(0,0,0,1), 0 0 0 1px #000, 0 0 80px rgba(230,0,0,.10)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[22px] opacity-[.05]"
              style={{ background: "repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 3px)" }}
            />
            <Screw className="left-2 top-2" />
            <Screw className="right-2 top-2" />
            <Screw className="bottom-2 left-2" />
            <Screw className="bottom-2 right-2" />

            {/* Backlit sign */}
            <div
              className="relative overflow-hidden rounded-[12px] px-4 py-3 sm:py-4"
              style={{
                background: "linear-gradient(180deg,#1d0303,#0a0101)",
                boxShadow: "inset 0 0 40px rgba(255,0,0,.18), inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 2px #050101",
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{ background: "radial-gradient(60% 120% at 50% 50%, rgba(255,30,30,.35), transparent 70%)" }}
              />
              <h1
                className="vx-sign relative text-center font-display text-2xl font-black tracking-[0.35em] text-[#ff3030] sm:text-4xl"
                style={{ textShadow: "0 0 6px #ff1a1a, 0 0 18px rgba(255,0,0,.8), 0 0 42px rgba(255,0,0,.5)" }}
              >
                VENDING X
              </h1>
              <p className="relative mt-1 text-center font-display text-[8px] tracking-[0.5em] text-white/35 sm:text-[9px]">
                MODEL VX-3000 · XOTIICTECH
              </p>
            </div>

            {/* Shelf selector */}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {(["free", "premium"] as const).map((t) => {
                const active = tier === t;
                const isPrem = t === "premium";
                const lockedTab = isPrem && !me?.premium;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchTier(t)}
                    disabled={busy}
                    aria-pressed={active}
                    className={`relative flex items-center justify-center gap-2 rounded-[8px] px-3 py-2 font-display text-[10px] tracking-[0.25em] transition sm:text-xs ${
                      active ? "translate-y-px text-white" : "text-white/45 hover:text-white/75"
                    }`}
                    style={{
                      background: active
                        ? "linear-gradient(180deg,#2a0606,#160303)"
                        : "linear-gradient(180deg,#2a2b30,#121316)",
                      boxShadow: active
                        ? "inset 0 2px 6px rgba(0,0,0,.8), 0 0 0 1px rgba(255,40,40,.45), 0 0 18px rgba(255,0,0,.18)"
                        : "inset 0 1px 0 rgba(255,255,255,.12), 0 3px 0 #050505, 0 0 0 1px #000",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: active ? (isPrem ? "#ff2d2d" : "#2bff6b") : "#3a3a3a",
                        boxShadow: active ? `0 0 8px ${isPrem ? "#ff2d2d" : "#2bff6b"}` : "none",
                      }}
                    />
                    {isPrem ? "PREMIUM" : "FREE"}
                    {lockedTab ? (
                      <LockGlyph />
                    ) : (
                      <span className="font-mono text-[9px] tracking-normal text-white/40">
                        {(isPrem ? totals.premium : totals.free).toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex flex-col gap-2.5 md:flex-row">
              {/* Glass + bin column */}
              <div className="min-w-0 flex-1">
                {/* Glass window with bezel */}
                <div
                  className="relative rounded-[12px] p-[6px]"
                  style={{
                    background: "linear-gradient(180deg,#6b6e76,#2a2b30 30%,#121316 70%,#3a3c42)",
                    boxShadow: "0 0 0 1px #000, inset 0 1px 0 rgba(255,255,255,.25)",
                  }}
                >
                  <div
                    className="relative z-10 overflow-hidden rounded-[7px] pb-5 pt-5"
                    style={{
                      background:
                        "radial-gradient(110% 60% at 50% 0%, rgba(255,50,50,.18), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 30px), linear-gradient(180deg,#140808 0%,#080303 100%)",
                      boxShadow: "inset 0 0 0 2px #040404, inset 0 14px 30px rgba(0,0,0,.85), inset 0 -24px 34px rgba(0,0,0,.85)",
                    }}
                  >
                    {/* Interior LED strip */}
                    <span
                      aria-hidden
                      className="vx-led-strip absolute inset-x-6 top-1.5 h-[3px] rounded-full"
                      style={{ background: "#ffd9d9", boxShadow: "0 0 10px #ff4d4d, 0 0 24px rgba(255,40,40,.8)" }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-24"
                      style={{ background: "linear-gradient(180deg, rgba(255,90,90,.16), transparent)" }}
                    />

                    <div className="relative space-y-3 sm:space-y-4">
                      {Array.from({ length: rows }, (_, r) => {
                        const codes = Array.from({ length: COLS }, (_, c) => `${LETTERS[r]}${c + 1}`);
                        return (
                          <div key={r}>
                            <div className="grid grid-cols-4 gap-1 px-2 sm:gap-2 sm:px-3">
                              {codes.map((code) => {
                                const it = bySlot[code];
                                return (
                                  <Slot
                                    key={code}
                                    code={code}
                                    item={it}
                                    selected={selected === code}
                                    spinning={spinningSlot === code}
                                    advance={advance?.slot === code ? advance.n : 0}
                                    disabled={busy || locked || !it || !it.count}
                                    pkgRef={(el) => {
                                      pkgRefs.current[code] = el;
                                    }}
                                    onPick={() => choose(code)}
                                  />
                                );
                              })}
                            </div>
                            <Rail codes={codes} bySlot={bySlot} selected={selected} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Glass: reflections + moving sheen, in front of the falling item */}
                  <div aria-hidden className="pointer-events-none absolute inset-[6px] z-[25] overflow-hidden rounded-[7px]">
                    <span
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(112deg, rgba(255,255,255,.11) 0%, rgba(255,255,255,.03) 16%, transparent 28%, transparent 60%, rgba(255,255,255,.05) 68%, transparent 76%)",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08), inset 0 0 50px rgba(0,0,0,.3)",
                      }}
                    />
                    <span
                      className="vx-sheen absolute -left-1/2 top-0 h-full w-1/3 -skew-x-12"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)" }}
                    />
                  </div>

                  {/* Locked premium shelf */}
                  {locked && (
                    <div className="absolute inset-[6px] z-[26] grid place-items-center rounded-[7px] bg-black/60 p-6 text-center backdrop-blur-[2px]">
                      <div className="max-w-xs">
                        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-blood/60 bg-blood/10 text-blood shadow-[0_0_30px_rgba(255,0,0,.25)]">
                          <LockGlyph className="h-6 w-6" />
                        </div>
                        <div className="font-display text-sm font-bold tracking-[0.25em] text-white">PREMIUM SHELF</div>
                        <p className="mt-2 text-xs text-muted">
                          {!me
                            ? "Log in with Discord to check your Premium role."
                            : !me.inServer
                              ? "Join the XotiicTech Discord server, then refresh this page."
                              : "Premium items need the Premium role or a server boost."}
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {!me ? (
                            <a href={LOGIN_URL} className="btn-primary btn-sm inline-flex items-center gap-2">
                              <DiscordGlyph /> Login with Discord
                            </a>
                          ) : (
                            <>
                              <Link href="/store/vendingx-premium" className="btn-primary btn-sm">
                                Get Premium — $3
                              </Link>
                              {!me.inServer && (
                                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                                  Join Discord
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metal panel between window and bin (hides the item mid-fall) */}
                <div
                  aria-hidden
                  className="relative z-30 mx-1 flex h-4 items-center justify-center gap-1"
                  style={{
                    background: "linear-gradient(180deg,#1a0303,#2c0606)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 1px 0 #000",
                  }}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className="h-[3px] w-4 rounded-full bg-black/70" />
                  ))}
                </div>

                {/* Pickup bin */}
                <div className="relative mt-1 rounded-[10px] p-[5px]" style={{ background: "linear-gradient(180deg,#3a3c42,#141518)", boxShadow: "0 0 0 1px #000" }}>
                  <div
                    ref={binRef}
                    className="relative z-10 h-[72px] rounded-[7px] sm:h-[84px]"
                    style={{
                      background: "linear-gradient(180deg,#000 0%,#0d0d0f 60%,#1b1c20 100%)",
                      boxShadow: "inset 0 14px 22px rgba(0,0,0,1), inset 0 -2px 0 rgba(255,255,255,.05)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={openFlap}
                    disabled={phase !== "landed"}
                    aria-label={phase === "landed" ? "Push the flap to collect your item" : "Pickup flap"}
                    className="absolute inset-[5px] z-[28] flex items-center justify-center rounded-[7px] outline-none transition-transform duration-500 ease-out disabled:cursor-default"
                    style={{
                      transformOrigin: "50% 0%",
                      transform: phase === "open" ? "perspective(500px) rotateX(-72deg)" : "perspective(500px) rotateX(0deg)",
                      background:
                        "linear-gradient(180deg, rgba(40,10,10,.72) 0%, rgba(15,3,3,.82) 100%), linear-gradient(115deg, rgba(255,255,255,.08), transparent 40%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 -10px 18px rgba(0,0,0,.5)",
                    }}
                  >
                    <span
                      className={`font-display text-[10px] tracking-[0.5em] sm:text-xs ${
                        phase === "landed" ? "vx-push text-[#ff4040]" : "text-white/20"
                      }`}
                    >
                      PUSH
                    </span>
                  </button>
                </div>
              </div>

              {/* Control panel */}
              <div
                className="relative z-30 flex flex-col gap-3 rounded-[12px] p-3 md:w-[176px]"
                style={{
                  background: "linear-gradient(180deg,#2c2d32,#141518 60%,#1d1e22)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), inset 0 -2px 0 rgba(0,0,0,.6), 0 0 0 1px #000",
                }}
              >
                {/* LCD */}
                <div className="rounded-[6px] bg-black p-[3px] shadow-[inset_0_2px_6px_rgba(0,0,0,1),0_1px_0_rgba(255,255,255,.1)]">
                  <div
                    className="relative overflow-hidden rounded-[4px] px-2.5 py-2 font-mono text-[11px] uppercase leading-snug"
                    style={{
                      background: "radial-gradient(ellipse at 50% 30%, #2e0707, #0b0101)",
                      color: "#ff5252",
                      textShadow: "0 0 6px rgba(255,40,40,.85)",
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="truncate">{lcd[0]}</div>
                    <div className="truncate opacity-80">
                      {lcd[1]}
                      <span className="vx-caret">_</span>
                    </div>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px)" }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,.07), transparent 45%)" }}
                    />
                  </div>
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-4 gap-1.5">
                  {keypad.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => press(k)}
                      disabled={busy}
                      className={`h-8 rounded-[4px] font-display text-[11px] font-bold transition active:translate-y-px disabled:opacity-50 ${
                        entry === k ? "text-[#ff4040]" : "text-white/85"
                      }`}
                      style={{
                        background: "linear-gradient(180deg,#45474e,#202126)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 2px 0 #050505, 0 0 0 1px #000",
                      }}
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => press("CLR")}
                    disabled={busy}
                    className="col-span-4 h-7 rounded-[4px] font-display text-[10px] tracking-[0.3em] text-[#ff6b6b] transition active:translate-y-px disabled:opacity-50"
                    style={{
                      background: "linear-gradient(180deg,#3a0c0c,#1a0404)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), 0 2px 0 #050505, 0 0 0 1px #000",
                    }}
                  >
                    CLEAR
                  </button>
                </div>

                {/* VEND button */}
                <div className="flex justify-center py-1">
                  <div
                    className={`rounded-full p-[5px] ${selectedItem && !busy ? "vx-ready" : ""}`}
                    style={{ background: "conic-gradient(from 200deg,#8a8d95,#2a2b30,#c5c7cc,#2a2b30,#8a8d95)" }}
                  >
                    <button
                      type="button"
                      onClick={vend}
                      disabled={busy}
                      className="grid h-[72px] w-[72px] place-items-center rounded-full font-display text-sm font-black tracking-[0.2em] text-white transition active:scale-95 disabled:cursor-wait"
                      style={{
                        background: selectedItem ? "radial-gradient(circle at 40% 30%, #ff4a4a, #c00000 55%, #6b0000)" : "radial-gradient(circle at 40% 30%, #8a2020, #4a0000 60%, #2a0000)",
                        boxShadow: "inset 0 3px 5px rgba(255,255,255,.3), inset 0 -5px 8px rgba(0,0,0,.5), 0 4px 0 #1a0000, 0 6px 14px rgba(0,0,0,.6)",
                      }}
                    >
                      {phase === "processing" ? "···" : "VEND"}
                    </button>
                  </div>
                </div>

                {/* Payment hardware (decor) */}
                <div aria-hidden className="mt-auto flex items-end justify-between gap-2 px-1">
                  <div className="flex flex-col items-center gap-1">
                    <span className="block h-9 w-2.5 rounded-sm bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,1),0_0_0_2px_#55585f]" />
                    <span className="font-display text-[6px] tracking-[0.2em] text-white/30">COINS</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="relative block h-6 w-12 rounded-[3px] bg-[#0b0b0d] shadow-[inset_0_1px_3px_rgba(0,0,0,1),0_0_0_2px_#55585f]">
                      <span className="absolute left-1 top-1 h-1 w-1 rounded-full bg-[#2bff6b] shadow-[0_0_6px_#2bff6b]" />
                      <span className="absolute inset-x-1.5 bottom-1.5 h-px bg-white/20" />
                    </span>
                    <span className="font-display text-[6px] tracking-[0.2em] text-white/30">CARD</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="block h-4 w-6 rounded-[2px] bg-black shadow-[inset_0_3px_4px_rgba(0,0,0,1),0_0_0_2px_#55585f]" />
                    <span className="font-display text-[6px] tracking-[0.2em] text-white/30">RETURN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Falling item (sits between the shelves and the glass) */}
            {drop && (phase === "dropping" || phase === "landed") && (
              <div
                ref={dropRef}
                aria-hidden
                className="pointer-events-none absolute z-20"
                style={{ left: drop.x, top: drop.y, width: drop.w, height: drop.h }}
              >
                <Package item={drop.item} />
              </div>
            )}

            {/* Collected item */}
            <AnimatePresence>
              {phase === "open" && prize && (
                <div className="absolute inset-x-3 bottom-3 z-40 flex justify-center">
                  <motion.div
                    initial={{ y: 60, opacity: 0, scale: 0.94 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 40, opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    className="w-full max-w-md border border-blood/60 bg-black/95 p-4 shadow-[0_0_40px_rgba(255,0,0,.25)] backdrop-blur"
                    role="dialog"
                    aria-label={`${prize.item.name} dispensed`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="scale-75 sm:scale-90">
                        <Package item={prize.item} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-[10px] tracking-[0.3em] text-ok">DISPENSED · {prize.item.slot}</div>
                        <div className="truncate font-display text-base font-bold text-white">{prize.item.name}</div>
                      </div>
                    </div>
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all border border-line bg-[#050505] p-3 font-mono text-xs text-[#5bff8e]">
                      {prize.content}
                    </pre>
                    <p className="mt-2 text-[11px] text-amber">Copy it now. It won&apos;t be shown again.</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={copyPrize} className="btn-primary btn-sm flex-1">
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                      <button type="button" onClick={finish} className="btn-ghost btn-sm flex-1">
                        Done
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Feet + floor shadow */}
          <div aria-hidden className="relative mx-auto flex w-[86%] justify-between">
            <span className="h-3 w-10 rounded-b-md bg-gradient-to-b from-[#1a1b1f] to-black" />
            <span className="h-3 w-10 rounded-b-md bg-gradient-to-b from-[#1a1b1f] to-black" />
          </div>
          <div aria-hidden className="mx-auto -mt-2 h-6 w-[80%] rounded-[50%] bg-black/80 blur-xl" />

          {notice && (
            <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-3 border border-blood/40 bg-blood/5 px-4 py-3 text-center text-sm text-blood">
              {notice.text}
              {notice.login && (
                <a href={LOGIN_URL} className="btn-primary btn-sm inline-flex items-center gap-2">
                  <DiscordGlyph /> Login
                </a>
              )}
            </div>
          )}
          <p className="mt-4 text-center text-[11px] text-dim">
            Tip: type a slot on your keyboard (like <span className="font-mono text-muted">A2</span>) and press Enter.
          </p>
        </div>

        {/* ─── Sidebar ─── */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card">
            <div className="border-b border-line px-4 py-3 font-display text-xs font-bold tracking-[0.2em] text-blood">HOW IT WORKS</div>
            <ol className="space-y-3 p-4 text-xs text-muted">
              {[
                "Log in with Discord.",
                "Pick a slot: click it, or type the code on the keypad.",
                "Hit VEND, then push the flap to grab your item.",
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-blood/40 bg-blood/10 font-display text-[10px] text-blood">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="border-t border-line px-4 py-3 text-[11px] text-dim">
              The <span className="text-ok">Free</span> shelf is open to everyone. The <span className="text-blood">Premium</span> shelf
              needs the Premium role or a server boost in our Discord.
            </p>
            <div className="px-4 pb-4">
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm flex w-full items-center justify-center gap-2">
                <DiscordGlyph /> Join Discord
              </a>
            </div>
          </div>

          <div className="card">
            <div className="border-b border-line px-4 py-3 font-display text-xs font-bold tracking-[0.2em] text-blood">PREMIUM</div>
            {me?.premium ? (
              <div className="p-4 text-xs text-muted">
                <span className="font-display text-sm tracking-widest text-ok">ACTIVE ✓</span>
                <p className="mt-1">You can vend from both shelves.</p>
              </div>
            ) : (
              <Link href="/store/vendingx-premium" className="group block p-4 transition hover:bg-blood/5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold tracking-wider text-white">Unlock the Premium shelf</span>
                  <span className="font-display text-lg font-black text-blood">$3</span>
                </div>
                <p className="mt-1 text-[11px] text-muted">One-time payment. You get the Premium role in Discord.</p>
                <span className="mt-2 inline-block font-display text-[9px] tracking-widest text-blood/60 group-hover:text-blood">GET ACCESS →</span>
              </Link>
            )}
          </div>

          <Link href="/store/vendingx-bot-access" className="card group block p-4 transition hover:border-crimson/40">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold tracking-wider text-neutral-300">BOT ACCESS</span>
              <span className="font-display text-sm font-bold text-white">$50</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">Run your own Vending X bot in your server.</p>
          </Link>
        </aside>
      </div>

      <style>{`
        @keyframes vxCoilTurn { to { stroke-dashoffset: -38; } }
        .vx-coil-turn { animation: vxCoilTurn .32s linear infinite; }
        @keyframes vxSign { 0%, 18%, 22%, 62%, 64%, 100% { opacity: 1; } 20%, 63% { opacity: .55; } }
        .vx-sign { animation: vxSign 7s linear infinite; }
        @keyframes vxStrip { 0%, 100% { opacity: 1; } 50% { opacity: .82; } }
        .vx-led-strip { animation: vxStrip 3.2s ease-in-out infinite; }
        @keyframes vxSheen { 0%, 70% { transform: translateX(0) skewX(-12deg); } 100% { transform: translateX(520%) skewX(-12deg); } }
        .vx-sheen { animation: vxSheen 9s ease-in-out infinite; }
        @keyframes vxSelect { 0%, 100% { opacity: .65; } 50% { opacity: 1; } }
        .vx-select { animation: vxSelect 1.4s ease-in-out infinite; }
        @keyframes vxAdvance { from { transform: translateY(-6px) scale(.9); filter: brightness(.6); } to { transform: none; filter: none; } }
        .vx-advance { animation: vxAdvance .6s .25s cubic-bezier(.3,1.4,.6,1) both; }
        @keyframes vxThud { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(3px); } 60% { transform: translateY(-1px); } }
        .vx-thud { animation: vxThud .26s ease-out; }
        @keyframes vxHum { 0%, 100% { transform: translate(0,0); } 25% { transform: translate(.4px,-.3px); } 75% { transform: translate(-.4px,.3px); } }
        .vx-hum { animation: vxHum .09s linear infinite; }
        @keyframes vxPush { 0%, 100% { opacity: 1; text-shadow: 0 0 10px #ff2020; } 50% { opacity: .45; text-shadow: none; } }
        .vx-push { animation: vxPush 1s ease-in-out infinite; }
        @keyframes vxReady { 0%, 100% { box-shadow: 0 0 0 rgba(255,0,0,0); } 50% { box-shadow: 0 0 26px rgba(255,30,30,.55); } }
        .vx-ready { animation: vxReady 1.3s ease-in-out infinite; }
        @keyframes vxCaret { 50% { opacity: 0; } }
        .vx-caret { animation: vxCaret 1s step-end infinite; }
        @media (prefers-reduced-motion: reduce) {
          .vx-coil-turn, .vx-sign, .vx-led-strip, .vx-sheen, .vx-select, .vx-advance, .vx-thud, .vx-hum, .vx-push, .vx-ready, .vx-caret { animation: none; }
        }
      `}</style>
    </section>
  );
}
