"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";

/** Fetch an admin endpoint; redirects to login on 401. */
export function useAdmin<T>(path: string | null) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(`/admin${path}`));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/xotiic/login");
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [path, router]);

  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export async function adminCall<T = unknown>(path: string, method: string, json?: unknown): Promise<T> {
  return api<T>(`/admin${path}`, { method, json });
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-black uppercase tracking-wider text-white">
        <span className="text-blood">&gt;</span> {title}
      </h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "muted" | "info" }) {
  const cls = {
    ok: "border-ok/50 text-ok",
    warn: "border-amber/50 text-amber",
    bad: "border-blood/60 text-blood",
    info: "border-cyan/50 text-cyan",
    muted: "border-edge text-muted",
  }[tone];
  return <span className={`inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>{children}</span>;
}

export function statusTone(s: string): "ok" | "warn" | "bad" | "muted" | "info" {
  if (["online", "healthy", "paid", "success", "published", "replied", "deployed", "approved"].includes(s)) return "ok";
  if (["new", "pending", "partial", "requested", "running", "unknown"].includes(s)) return "warn";
  if (["offline", "invalid", "error", "failed", "refunded", "rejected"].includes(s)) return "bad";
  return "muted";
}

export function Panel({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="border border-line bg-ink">
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          {title && <div className="text-[11px] uppercase tracking-[0.25em] text-muted">{title}</div>}
          {actions}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.2em] text-dim">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <div className="px-4 py-10 text-center text-sm text-dim">Nothing here.</div>}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-crimson/50 bg-black shadow-neon-lg"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="font-display text-sm font-bold uppercase tracking-widest text-white">{title}</div>
              <button onClick={onClose} className="text-xl text-blood" aria-label="Close">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Notice({ msg, onDone }: { msg: { kind: "ok" | "error"; text: string } | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`fixed bottom-5 right-5 z-[70] max-w-sm border px-4 py-3 text-sm shadow-neon ${
            msg.kind === "ok" ? "border-ok/60 bg-black text-ok" : "border-blood bg-black text-blood"
          }`}
        >
          {msg.kind === "ok" ? "✓ " : "! "}
          {msg.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useNotice() {
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const clear = useCallback(() => setMsg(null), []);
  const ok = useCallback((text: string) => setMsg({ kind: "ok", text }), []);
  const fail = useCallback((e: unknown) => setMsg({ kind: "error", text: e instanceof Error ? e.message : String(e) }), []);
  return { notice: <Notice msg={msg} onDone={clear} />, ok, fail };
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 border transition ${checked ? "border-crimson bg-crimson/30" : "border-edge bg-black"}`}
      >
        <span className={`absolute top-0.5 h-3.5 w-3.5 transition-all ${checked ? "left-[18px] bg-blood shadow-neon" : "left-0.5 bg-dim"}`} />
      </button>
      <span className="text-neutral-300">{label}</span>
    </label>
  );
}
