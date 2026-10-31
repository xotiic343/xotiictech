"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { AnimationEvent as RAnimationEvent, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StockIcon } from "@/components/vendingx/StockIcon";

/* ── Types ── */

type StockEntry = { name: string; description: string; count: number; premium: boolean; icon: string | null };
type Item = StockEntry & { key: string; slot: string; page: number };
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
type Flip = { dir: 1 | -1; stage: "out" | "in"; next: number } | null;
type Notice = { text: string; login?: boolean } | null;

/* ── Constants ── */

const COLS = 6;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;
const POLL_MS = 20_000;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, ROWS).split("");
const DIGITS = Array.from({ length: COLS }, (_, i) => String(i + 1));
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/xotiictech";
const LOGIN_URL = "/support/api/auth/signin?callbackUrl=/vendingx";
const DROP_MS = 1250;
const BOX = "h-[42px] w-[30px] sm:h-[66px] sm:w-[50px]";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (s: string) => s.toUpperCase().slice(0, 13);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Layout position of el inside root, ignoring CSS transforms such as the hover lift. */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

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

/* ── Products are drawn flat in perspective: no 3D layers, so the page stays smooth and nothing can
   paint over anything else. A View says where a slot sits relative to the eye: sx runs -1 (far left)
   to 1 (far right), ty from 0 (eye level) to 1 (far below). Depth comes from --d on an ancestor. ── */

type View = { sx: number; ty: number };
const CARD_VIEW: View = { sx: -0.7, ty: 0.7 };

function viewOf(col: number, row: number): View {
  // The viewer stands a little right of the machine (its right side panel shows), so the
  // vanishing point sits right of centre: most boxes show their right side.
  return { sx: (col / (COLS - 1)) * 1.2 - 1, ty: (row + 0.4) / ROWS };
}

/** Transform that moves something `steps` boxes deeper into the machine: toward the centre, up, smaller. */
function deeper(v: View, steps: number) {
  const dx = -v.sx * 0.6 * steps;
  const dy = -(v.ty * 0.8 + 0.15) * steps;
  return `translate(calc(var(--d) * ${dx.toFixed(3)}), calc(var(--d) * ${dy.toFixed(3)})) scale(${(1 - 0.06 * steps).toFixed(3)})`;
}

function Box({ item, view, sides = true }: { item: Pick<Item, "key" | "name" | "icon" | "premium">; view: View; sides?: boolean }) {
  const prem = item.premium;
  const sideBg = prem ? "linear-gradient(180deg,#5a0b0b,#1c0202)" : "linear-gradient(180deg,#2c2e34,#0c0c0e)";
  const topBg = prem ? "linear-gradient(0deg,#8a1818,#420707)" : "linear-gradient(0deg,#5a5d64,#222328)";
  const sideW = Math.abs(view.sx) * 0.8;
  const topH = view.ty * 0.75;
  const rightSide = view.sx <= 0; // left of centre, so the box's right side faces you
  return (
    <div className="relative h-full w-full">
      {topH > 0.04 && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-full origin-bottom"
          style={{
            height: `calc(var(--d) * ${topH.toFixed(3)})`,
            transform: `skewX(${(view.sx * 38).toFixed(1)}deg)`,
            background: topBg,
          }}
        />
      )}
      {sides && sideW > 0.04 && (
        <span
          aria-hidden
          className={`absolute inset-y-0 ${rightSide ? "left-full origin-left" : "right-full origin-right"}`}
          style={{
            width: `calc(var(--d) * ${sideW.toFixed(3)})`,
            transform: `skewY(${((rightSide ? -1 : 1) * (view.ty * 40 + 6)).toFixed(1)}deg)`,
            background: sideBg,
          }}
        />
      )}
      <div
        className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[3px] px-0.5 pb-0.5 pt-1.5 sm:px-1 sm:pb-1 sm:pt-2"
        style={{
          background: prem
            ? "linear-gradient(160deg,#781313 0%,#3a0707 42%,#170202 100%)"
            : "linear-gradient(160deg,#3a3c43 0%,#1b1c21 42%,#0b0b0d 100%)",
          border: `1px solid ${prem ? "rgba(255,90,90,.3)" : "rgba(255,255,255,.1)"}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), inset 0 -10px 14px rgba(0,0,0,.5)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[4px] sm:h-[5px]"
          style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,.24) 0 2px, rgba(0,0,0,.35) 2px 4px)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/2 -skew-x-12"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent)" }}
        />
        <span className={`relative mt-0.5 ${prem ? "text-[#ff7a7a]" : "text-neutral-100"} drop-shadow-[0_0_6px_rgba(255,50,50,.35)]`}>
          <StockIcon icon={item.icon} stockKey={item.key} name={item.name} className="h-4 w-4 sm:h-7 sm:w-7" />
        </span>
        <span className="relative hidden w-full truncate text-center font-display text-[6.5px] font-bold uppercase tracking-wider text-white/85 sm:block">
          {item.name}
        </span>
      </div>
    </div>
  );
}

/** Spiral coil loops stepping back into the machine. The front loop is drawn over the front box, the
    rest behind it. Spinning runs the wire around each loop. */
function CoilLoops({ view, part, spinning, dim }: { view: View; part: "back" | "front"; spinning: boolean; dim: boolean }) {
  const loops = part === "front" ? [0] : [3, 2, 1];
  return (
    <>
      {loops.map((i) => (
        <svg
          key={i}
          viewBox="0 0 64 64"
          aria-hidden
          className="pointer-events-none absolute -bottom-[3px] left-1/2 h-[38px] w-[38px] sm:-bottom-[5px] sm:h-[60px] sm:w-[60px]"
          style={{ transform: `translateX(-50%) ${deeper(view, i * 0.9)}` }}
        >
          <circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke="url(#vx-metal)"
            strokeWidth={i === 0 ? 2.6 : 2.2}
            strokeLinecap="round"
            strokeDasharray="150 32"
            opacity={dim ? 0.3 : 1 - i * 0.2}
            className={spinning ? "vx-coil-turn" : undefined}
            style={{ animationDelay: `${i * -0.07}s` }}
          />
        </svg>
      ))}
    </>
  );
}

function Slot({
  item,
  code,
  view,
  selected,
  spinning,
  advance,
  disabled,
  pkgRef,
  onPick,
}: {
  item?: Item;
  code: string;
  view: View;
  selected: boolean;
  spinning: boolean;
  advance: number;
  disabled: boolean;
  pkgRef: (el: HTMLDivElement | null) => void;
  onPick: () => void;
}) {
  const count = item?.count ?? 0;
  const copies = item ? Math.min(count, 3) : 0;
  const advanceFrom = { "--from": deeper(view, 1) } as CSSProperties;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={item ? `${code}: ${item.name}, ${count ? `${count} left` : "sold out"}` : `${code}: empty`}
      aria-pressed={selected}
      className="group relative flex h-[66px] items-end justify-center outline-none sm:h-[100px]"
    >
      {selected && (
        <span
          aria-hidden
          className="vx-select absolute inset-x-0 bottom-2 top-1 rounded-lg"
          style={{ background: "radial-gradient(60% 60% at 50% 65%, rgba(255,40,40,.5), transparent 70%)" }}
        />
      )}
      <div className={`relative mb-[3px] sm:mb-[5px] ${BOX}`}>
        <CoilLoops view={view} part="back" spinning={spinning} dim={!copies} />
        {item &&
          Array.from({ length: Math.max(copies - 1, 0) }, (_, k) => copies - 1 - k).map((i) => (
            <div key={i} className="absolute inset-0" style={{ transform: deeper(view, i), filter: `brightness(${1 - 0.25 * i})` }}>
              <Box item={item} view={view} sides={false} />
            </div>
          ))}
        {item && copies > 0 && (
          <div
            key={`front-${advance}`}
            ref={pkgRef}
            className={`absolute inset-0 transition-transform duration-200 group-hover:-translate-y-[3px] ${selected ? "-translate-y-[3px]" : ""} ${
              advance ? "vx-advance" : ""
            }`}
            style={advanceFrom}
          >
            <Box item={item} view={view} />
          </div>
        )}
        <CoilLoops view={view} part="front" spinning={spinning} dim={!copies} />
      </div>
      {item && count === 0 && (
        <span className="absolute bottom-[38%] font-display text-[6px] tracking-[0.2em] text-red-500/80 sm:text-[8px]">SOLD OUT</span>
      )}
    </button>
  );
}

function Rail({ codes, bySlot, selected }: { codes: string[]; bySlot: Record<string, Item>; selected: string | null }) {
  return (
    <div
      className="relative mx-0.5 grid h-[15px] grid-cols-6 gap-0.5 rounded-[2px] px-1 sm:h-[18px] sm:gap-1 sm:px-2"
      style={{
        background: "linear-gradient(180deg,#62656e 0%,#2a2b30 32%,#111215 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), 0 8px 12px rgba(0,0,0,.8)",
      }}
    >
      {codes.map((code) => {
        const it = bySlot[code];
        const on = !!it && it.count > 0;
        return (
          <div key={code} className="flex items-center justify-center gap-0.5 sm:gap-1">
            <span
              className={`rounded-[2px] px-0.5 font-display text-[6px] leading-[10px] ring-1 sm:px-1 sm:text-[8px] sm:leading-[12px] ${
                selected === code ? "bg-[#ff2a2a] text-black ring-[#ff7070]" : "bg-black/80 text-white/85 ring-white/10"
              }`}
            >
              {code}
            </span>
            {it && (
              <span
                className="h-[4px] w-[4px] rounded-full sm:h-[5px] sm:w-[5px]"
                style={{ background: on ? "#2bff6b" : "#ff2d2d", boxShadow: on ? "0 0 5px #2bff6b" : "0 0 5px #ff2d2d" }}
              />
            )}
            {it && <span className="hidden font-mono text-[8px] text-white/55 md:inline">{it.count}</span>}
          </div>
        );
      })}
    </div>
  );
}

function PanelKey({
  children,
  onClick,
  disabled,
  active,
  danger,
  className = "",
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`h-8 rounded-[4px] font-display text-[11px] font-bold transition active:translate-y-px disabled:opacity-40 ${
        danger ? "text-[#ff6b6b]" : active ? "text-[#ff4040]" : "text-white/85"
      } ${className}`}
      style={{
        background: danger ? "linear-gradient(180deg,#3a0c0c,#1a0404)" : "linear-gradient(180deg,#46484f,#1f2025)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 2px 0 #050505, 0 0 0 1px #000",
      }}
    >
      {children}
    </button>
  );
}

/* ── Page ── */

export default function VendingXPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [stock, setStock] = useState<Record<string, StockEntry> | null>(null);
  const [offline, setOffline] = useState(false);
  const [tier, setTier] = useState<Tier>("free");
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState<Flip>(null);
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
      .map(([key, s], i) => {
        const j = i % PER_PAGE;
        return { ...s, key, page: Math.floor(i / PER_PAGE), slot: `${LETTERS[Math.floor(j / COLS)]}${(j % COLS) + 1}` };
      });
  }, [stock, tier, locked]);

  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const curPage = Math.min(page, pages - 1);
  const bySlot = useMemo(
    () => Object.fromEntries(items.filter((i) => i.page === curPage).map((i) => [i.slot, i])),
    [items, curPage],
  );
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
    if (phase !== "idle" || selected || entry || flip) return;
    const shelf = tier === "premium" ? "PREMIUM" : "FREE";
    if (!stock) setLcd(["WELCOME", "LOADING..."]);
    else if (offline) setLcd(["OFFLINE", "TRY AGAIN SOON"]);
    else if (locked) setLcd(["PREMIUM SHELF", me ? "ROLE REQUIRED" : "LOGIN REQUIRED"]);
    else if (!items.length) setLcd(["RESTOCKING", "CHECK BACK SOON"]);
    else setLcd([`${shelf} PG ${curPage + 1}/${pages}`, "SELECT AN ITEM"]);
  }, [phase, selected, entry, flip, stock, offline, locked, me, items.length, tier, curPage, pages]);

  /* ── Selection ── */

  function choose(slot: string) {
    if (phase !== "idle" || flip) return;
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
    if (phase !== "idle" || flip) return;
    if (key === "CLR") return clearSelection();
    if (/^[A-Z]$/.test(key)) {
      if (!LETTERS.includes(key)) {
        setLcd([`ROW ${key}`, "NO SUCH ROW"]);
        return;
      }
      setSelected(null);
      setEntry(key);
      setLcd([`${key}_`, `ENTER NUMBER 1-${COLS}`]);
      return;
    }
    if (!DIGITS.includes(key)) return;
    if (!entry) {
      setLcd(["PICK A ROW", "LETTER FIRST"]);
      return;
    }
    choose(`${entry}${key}`);
  }

  function turn(dir: 1 | -1) {
    if (phase !== "idle" || flip || pages < 2) return;
    clearSelection();
    const next = (curPage + dir + pages) % pages;
    if (reducedMotion.current) {
      setPage(next);
      return;
    }
    setFlip({ dir, stage: "out", next });
  }

  function onRackAnimationEnd(e: RAnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !flip) return;
    if (flip.stage === "out") {
      setPage(flip.next);
      setFlip({ ...flip, stage: "in" });
    } else {
      setFlip(null);
    }
  }

  function switchTier(t: Tier) {
    if (phase !== "idle" || flip || t === tier) return;
    setTier(t);
    setPage(0);
    clearSelection();
  }

  /* ── Vending ── */

  async function vend() {
    if (phase !== "idle" || flip) return;
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
    const minSpin = sleep(reducedMotion.current ? 0 : 1000);

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
    setLcd(["DISPENSING", "PLEASE WAIT"]);

    const front = machineRef.current;
    const pkg = pkgRefs.current[item.slot];
    const bin = binRef.current;
    if (reducedMotion.current || !front || !pkg || !bin) {
      setAdvance((a) => ({ slot: item.slot, n: (a?.n ?? 0) + 1 }));
      setPhase("landed");
      setLcd(["THANK YOU", "PUSH FLAP TO COLLECT"]);
      return;
    }
    // Falls straight down off the coil, tumbles in 3D and lands on its side in the pickup bin.
    const p = offsetIn(pkg, front);
    const b = offsetIn(bin, front);
    const w = pkg.offsetWidth;
    const h = pkg.offsetHeight;
    const startCx = p.x + w / 2;
    const landCx = clamp(startCx, b.x + h / 2 + 12, b.x + bin.offsetWidth - h / 2 - 12);
    const landCy = b.y + bin.offsetHeight - 10 - w / 2;
    setDrop({ item, x: p.x, y: p.y, w, h, dx: landCx - startCx, dy: landCy - (p.y + h / 2) });
    setAdvance((a) => ({ slot: item.slot, n: (a?.n ?? 0) + 1 }));
    setPhase("dropping");
  }

  useEffect(() => {
    const el = dropRef.current;
    if (!drop || !el) return;
    const { dx, dy } = drop;
    const t = (x: number, y: number, z: number, rx: number, rz: number) =>
      `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateZ(${rz}deg)`;
    const anim = el.animate(
      [
        { transform: t(0, 0, 0, 0, 0), offset: 0, easing: "ease-out" },
        { transform: t(0, 6, 22, -32, -4), offset: 0.16, easing: "cubic-bezier(.55,0,1,.45)" },
        { transform: t(dx, dy, 10, -14, 94), offset: 0.7, easing: "cubic-bezier(.2,.65,.45,1)" },
        { transform: t(dx, dy - 22, 6, -8, 100), offset: 0.8, easing: "cubic-bezier(.55,0,1,.45)" },
        { transform: t(dx, dy, 0, -4, 90), offset: 0.9, easing: "ease-out" },
        { transform: t(dx, dy - 4, 0, -2, 91), offset: 0.95 },
        { transform: t(dx, dy, 0, 0, 90), offset: 1 },
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

  const keys = useRef({ press, vend, openFlap, finish, turn, phase });
  useEffect(() => {
    keys.current = { press, vend, openFlap, finish, turn, phase };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const k = e.key.toUpperCase();
      const h = keys.current;
      if (k === "ENTER") {
        if (h.phase === "landed") h.openFlap();
        else if (h.phase === "idle") h.vend();
        else return;
      } else if (k === "ESCAPE") {
        if (h.phase === "open") h.finish();
        else h.press("CLR");
      } else if (k === "ARROWRIGHT" || k === "]") {
        h.turn(1);
      } else if (k === "ARROWLEFT" || k === "[") {
        h.turn(-1);
      } else if (/^[A-Z0-9]$/.test(k)) {
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

  const busy = phase !== "idle" || !!flip;
  const spinningSlot = phase === "processing" || phase === "dropping" ? selected : null;
  const flipClass = flip ? `vx-flip-${flip.stage}-${flip.dir > 0 ? "next" : "prev"}` : "";

  /* ── Render ── */

  return (
    <section className="container-x overflow-x-clip py-10">
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
      <div className="mx-auto mb-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
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

      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* ─── Machine ─── */}
        <div>
          {/* No real 3D on the cabinet: Chrome redraws tilted 3D elements taller than the screen in
              pieces while scrolling. Depth is drawn instead, as if you stand a little to the right. */}
          <div className="mx-auto w-full max-w-[860px] pb-2 pr-[34px] pt-4 md:pr-[78px]">
            <div className="relative [--D:34px] md:[--D:78px]">
              {/* Cabinet side panel, receding to the right */}
              <div
                aria-hidden
                className="absolute bottom-0 left-full top-0 w-[var(--D)] overflow-hidden"
                style={{
                  clipPath: "polygon(0 0, 100% 3.5%, 100% 97.5%, 0 100%)",
                  background: "linear-gradient(90deg,#430909 0%,#230404 40%,#0b0101 100%)",
                }}
              >
                <span className="absolute inset-0 opacity-[.06]" style={{ background: "repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px)" }} />
                <span className="absolute inset-y-0 left-0 w-[2px] bg-white/10" />
                <span className="absolute left-1/2 top-[16%] -translate-x-1/2 font-display text-[9px] font-black tracking-[0.6em] text-[#ff3030]/75 [writing-mode:vertical-rl] md:text-sm">
                  VENDING X
                </span>
                <div className="absolute bottom-[9%] left-1/2 flex -translate-x-1/2 flex-col gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className="h-[3px] w-4 rounded-full bg-black/70 md:w-9" />
                  ))}
                </div>
              </div>

              {/* Front of the machine */}
              <div
                ref={machineRef}
                className={`relative isolate rounded-[22px] p-2 [--d:10px] sm:p-4 sm:[--d:14px] ${thud ? "vx-thud" : ""} ${
                  phase === "processing" ? "vx-hum" : ""
                }`}
                style={{
                  background: "linear-gradient(180deg,#4d0b0b 0%,#280505 15%,#170303 62%,#260505 100%)",
                  boxShadow:
                    "inset 0 2px 0 rgba(255,255,255,.16), inset 0 -4px 0 rgba(0,0,0,.6), inset 4px 0 8px rgba(255,255,255,.05), inset -6px 0 10px rgba(0,0,0,.5), 0 0 0 1px #000",
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
                    boxShadow: "inset 0 0 40px rgba(255,0,0,.2), inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 2px #050101",
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
                          background: active ? "linear-gradient(180deg,#2a0606,#160303)" : "linear-gradient(180deg,#2a2b30,#121316)",
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
                        {isPrem && !me?.premium ? (
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
                  {/* Glass + bin */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="relative rounded-[12px] p-[6px]"
                      style={{
                        background: "linear-gradient(180deg,#6b6e76,#2a2b30 30%,#121316 70%,#3a3c42)",
                        boxShadow: "0 0 0 1px #000, inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 0 rgba(0,0,0,.5)",
                      }}
                    >
                      {/* Cabinet interior: side walls and ceiling drawn as trapezoids receding to the back */}
                      <div
                        className="relative z-10 overflow-hidden rounded-[7px] pb-3 pt-6 sm:pb-4 sm:pt-8"
                        style={{
                          background: "radial-gradient(90% 55% at 50% 30%, #2a0d0d 0%, #0d0505 60%, #050202 100%)",
                          boxShadow: "inset 0 0 0 2px #040404, inset 0 18px 30px rgba(0,0,0,.8), inset 0 -24px 34px rgba(0,0,0,.85)",
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-[7%]"
                          style={{ clipPath: "polygon(0 0, 100% 5%, 100% 95%, 0 100%)", background: "linear-gradient(90deg,#2e0e0e,#0c0404)" }}
                        />
                        <span
                          aria-hidden
                          className="absolute inset-y-0 right-0 w-[7%]"
                          style={{ clipPath: "polygon(0 5%, 100% 0, 100% 100%, 0 95%)", background: "linear-gradient(270deg,#2e0e0e,#0c0404)" }}
                        />
                        <span
                          aria-hidden
                          className="absolute inset-x-0 top-0 h-6 sm:h-8"
                          style={{ clipPath: "polygon(0 0, 100% 0, 93% 100%, 7% 100%)", background: "linear-gradient(180deg,#3a1212,#0c0404)" }}
                        />
                        <span
                          aria-hidden
                          className="vx-led-strip absolute inset-x-6 top-1.5 h-[3px] rounded-full"
                          style={{ background: "#ffd9d9", boxShadow: "0 0 10px #ff4d4d, 0 0 26px rgba(255,40,40,.8)" }}
                        />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 top-0 h-28"
                          style={{ background: "linear-gradient(180deg, rgba(255,90,90,.18), transparent)" }}
                        />

                        {/* Shelf rack: turns like a drum between pages */}
                        <div
                          className={`relative space-y-1.5 sm:space-y-2.5 ${flipClass}`}
                          style={{ transformOrigin: "50% 50%" }}
                          onAnimationEnd={onRackAnimationEnd}
                        >
                          {LETTERS.map((row, r) => {
                            const codes = DIGITS.map((d) => `${row}${d}`);
                            const floorDepth = viewOf(0, r).ty * 2.2;
                            return (
                              <div key={row} className="relative">
                                {/* Shelf surface you can see from above */}
                                <div
                                  aria-hidden
                                  className="pointer-events-none absolute inset-x-1 bottom-[15px] sm:bottom-[18px]"
                                  style={{
                                    height: `calc(var(--d) * ${floorDepth.toFixed(2)} + 2px)`,
                                    clipPath: "polygon(0 100%, 100% 100%, 94% 0, 6% 0)",
                                    background: "linear-gradient(0deg,#4a4c53 0%,#1b1c20 45%,#0d0d10 100%)",
                                  }}
                                />
                                <div className="grid grid-cols-6 gap-0.5 px-1 sm:gap-1 sm:px-2">
                                  {codes.map((code, c) => {
                                    const it = bySlot[code];
                                    return (
                                      <Slot
                                        key={code}
                                        code={code}
                                        view={viewOf(c, r)}
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

                      {/* Glass: thickness, reflections and a moving sheen, in front of the falling item */}
                      <div aria-hidden className="pointer-events-none absolute inset-[6px] z-[25] overflow-hidden rounded-[7px]">
                        <span
                          className="absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(112deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.03) 16%, transparent 28%, transparent 60%, rgba(255,255,255,.05) 68%, transparent 76%)",
                            boxShadow:
                              "inset 0 0 0 1px rgba(255,255,255,.1), inset 3px 3px 0 rgba(255,255,255,.04), inset -3px -3px 0 rgba(0,0,0,.3), inset 0 0 50px rgba(0,0,0,.3)",
                          }}
                        />
                        <span
                          className="vx-sheen absolute -left-1/2 top-0 h-full w-1/3 -skew-x-12"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)" }}
                        />
                      </div>

                      {/* Locked premium shelf */}
                      {locked && (
                        <div className="absolute inset-[6px] z-[26] grid place-items-center rounded-[7px] bg-black/75 p-6 text-center">
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
                      style={{ background: "linear-gradient(180deg,#1a0303,#2c0606)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 1px 0 #000" }}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <span key={i} className="h-[3px] w-4 rounded-full bg-black/70" />
                      ))}
                    </div>

                    {/* Pickup bin */}
                    <div className="relative mt-1 rounded-[10px] p-[5px]" style={{ background: "linear-gradient(180deg,#3a3c42,#141518)", boxShadow: "0 0 0 1px #000" }}>
                      <div
                        ref={binRef}
                        className="relative z-10 h-[70px] rounded-[7px] sm:h-[84px]"
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
                        <span className={`font-display text-[10px] tracking-[0.5em] sm:text-xs ${phase === "landed" ? "vx-push text-[#ff4040]" : "text-white/20"}`}>
                          PUSH
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Control panel */}
                  <div
                    className="relative z-30 flex flex-col gap-3 rounded-[12px] p-3 md:w-[188px]"
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

                    {/* Page turner */}
                    <div className="flex items-center gap-1.5">
                      <PanelKey onClick={() => turn(-1)} disabled={busy || pages < 2} className="w-9" label="Previous page">
                        ◀
                      </PanelKey>
                      <div className="flex flex-1 flex-col items-center justify-center gap-1">
                        <span className="font-display text-[9px] tracking-[0.3em] text-white/55">
                          PAGE {curPage + 1}/{pages}
                        </span>
                        <span className="flex gap-1">
                          {Array.from({ length: pages }, (_, i) => (
                            <span
                              key={i}
                              className="h-1 w-3 rounded-full"
                              style={{ background: i === curPage ? "#ff2d2d" : "#3a3b40", boxShadow: i === curPage ? "0 0 6px #ff2d2d" : "none" }}
                            />
                          ))}
                        </span>
                      </div>
                      <PanelKey onClick={() => turn(1)} disabled={busy || pages < 2} className="w-9" label="Next page">
                        ▶
                      </PanelKey>
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-6 gap-1">
                      {LETTERS.map((k) => (
                        <PanelKey key={k} onClick={() => press(k)} disabled={busy} active={entry === k}>
                          {k}
                        </PanelKey>
                      ))}
                      <PanelKey onClick={() => press("CLR")} disabled={busy} danger label="Clear" className="text-[8px]">
                        CLR
                      </PanelKey>
                      {DIGITS.map((k) => (
                        <PanelKey key={k} onClick={() => press(k)} disabled={busy}>
                          {k}
                        </PanelKey>
                      ))}
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
                            background: selectedItem
                              ? "radial-gradient(circle at 40% 30%, #ff4a4a, #c00000 55%, #6b0000)"
                              : "radial-gradient(circle at 40% 30%, #8a2020, #4a0000 60%, #2a0000)",
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

                {/* Falling item: between the shelves and the glass */}
                {drop && (phase === "dropping" || phase === "landed") && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-20"
                    style={{ left: drop.x, top: drop.y, width: drop.w, height: drop.h, perspective: "600px" }}
                  >
                    <div ref={dropRef} className="h-full w-full">
                      <Box item={drop.item} view={viewOf(Number(drop.item.slot.slice(1)) - 1, LETTERS.indexOf(drop.item.slot[0]))} />
                    </div>
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
                        className="w-full max-w-md border border-blood/60 bg-black/95 p-4 shadow-[0_0_40px_rgba(255,0,0,.25)]"
                        role="dialog"
                        aria-label={`${prize.item.name} dispensed`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 pb-1 pr-3 pt-3">
                            <div className={BOX}>
                              <Box item={prize.item} view={CARD_VIEW} />
                            </div>
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
            </div>
            <div aria-hidden className="mx-auto mt-3 h-8 w-[85%] rounded-[50%] bg-black/80 blur-xl" />
          </div>

          {notice && (
            <div className="mx-auto mt-2 flex max-w-md flex-wrap items-center justify-center gap-3 border border-blood/40 bg-blood/5 px-4 py-3 text-center text-sm text-blood">
              {notice.text}
              {notice.login && (
                <a href={LOGIN_URL} className="btn-primary btn-sm inline-flex items-center gap-2">
                  <DiscordGlyph /> Login
                </a>
              )}
            </div>
          )}
          <p className="mt-3 text-center text-[11px] text-dim">
            Type a slot on your keyboard (like <span className="font-mono text-muted">B4</span>), press Enter to vend, and use ← → to turn
            pages.
          </p>
        </div>

        {/* ─── Sidebar ─── */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card">
            <div className="border-b border-line px-4 py-3 font-display text-xs font-bold tracking-[0.2em] text-blood">HOW IT WORKS</div>
            <ol className="space-y-3 p-4 text-xs text-muted">
              {[
                "Log in with Discord.",
                "Find your item. Use ◀ ▶ to turn the shelves to the next page.",
                "Pick a slot, hit VEND, then push the flap to grab your item.",
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
        @keyframes vxCoilTurn { to { stroke-dashoffset: -182; } }
        .vx-coil-turn { animation: vxCoilTurn .55s linear infinite; }
        @keyframes vxSign { 0%, 18%, 22%, 62%, 64%, 100% { opacity: 1; } 20%, 63% { opacity: .55; } }
        .vx-sign { animation: vxSign 7s linear infinite; }
        @keyframes vxStrip { 0%, 100% { opacity: 1; } 50% { opacity: .82; } }
        .vx-led-strip { animation: vxStrip 3.2s ease-in-out infinite; }
        @keyframes vxSheen { 0%, 70% { transform: translateX(0) skewX(-12deg); } 100% { transform: translateX(520%) skewX(-12deg); } }
        .vx-sheen { animation: vxSheen 9s ease-in-out infinite; }
        @keyframes vxSelect { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
        .vx-select { animation: vxSelect 1.4s ease-in-out infinite; }
        @keyframes vxAdvance { from { transform: var(--from); filter: brightness(.75); } to { transform: none; filter: none; } }
        .vx-advance { animation: vxAdvance .7s .3s cubic-bezier(.3,1.3,.6,1) both; }
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
        @keyframes vxFlipOutNext { to { transform: translateX(-45%) scaleX(.08); filter: brightness(.3); } }
        @keyframes vxFlipInNext { from { transform: translateX(45%) scaleX(.08); filter: brightness(.3); } to { transform: none; filter: none; } }
        @keyframes vxFlipOutPrev { to { transform: translateX(45%) scaleX(.08); filter: brightness(.3); } }
        @keyframes vxFlipInPrev { from { transform: translateX(-45%) scaleX(.08); filter: brightness(.3); } to { transform: none; filter: none; } }
        .vx-flip-out-next { animation: vxFlipOutNext .26s cubic-bezier(.5,0,1,.6) forwards; }
        .vx-flip-in-next { animation: vxFlipInNext .36s cubic-bezier(.1,.6,.3,1.15) both; }
        .vx-flip-out-prev { animation: vxFlipOutPrev .26s cubic-bezier(.5,0,1,.6) forwards; }
        .vx-flip-in-prev { animation: vxFlipInPrev .36s cubic-bezier(.1,.6,.3,1.15) both; }
        @media (prefers-reduced-motion: reduce) {
          .vx-coil-turn, .vx-sign, .vx-led-strip, .vx-sheen, .vx-select, .vx-advance, .vx-thud, .vx-hum, .vx-push,
          .vx-ready, .vx-caret { animation: none; }
        }
      `}</style>
    </section>
  );
}
