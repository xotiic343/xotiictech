"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Field, FormStatus } from "@/components/forms";
import { GlitchText } from "@/components/fx/GlitchText";
import { api, ApiError } from "@/lib/client";
import { dateTime, money } from "@/lib/format";
import { emailSchema, passwordSchema } from "@/lib/validation";

type Me = { id: number; email: string; name: string | null; has_password: boolean };
type Order = {
  id: string;
  product_name: string;
  product_slug: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  has_download: boolean;
  is_hosted: boolean;
  hosting_status: string;
  hosting_server_id: string | null;
};

export default function AccountPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setMe(await api<Me>("/auth/me"));
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container-x pt-14">
      <div className="eyebrow mb-3">// buyer terminal</div>
      <h1 className="h-display text-3xl sm:text-5xl">
        <GlitchText text="My account" />
      </h1>
      <div className="mt-10">
        {me === undefined ? (
          <div className="text-sm text-muted">loading…</div>
        ) : me === null ? (
          <SignIn onSignedIn={load} />
        ) : (
          <Dashboard me={me} onChange={load} />
        )}
      </div>
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ok" | "error"; message?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailSchema.safeParse({ email }).success) return setStatus({ kind: "error", message: "Enter a valid email" });
    setStatus({ kind: "loading" });
    try {
      if (mode === "magic") {
        const r = await api<{ message: string }>("/auth/magic-link", { method: "POST", json: { email } });
        setStatus({ kind: "ok", message: r.message });
      } else {
        await api("/auth/login", { method: "POST", json: { email, password } });
        onSignedIn();
      }
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Sign-in failed" });
    }
  }

  return (
    <div className="card corner-brackets mx-auto max-w-md p-8">
      <div className="mb-6 grid grid-cols-2 border border-line text-[11px] uppercase tracking-[0.2em]">
        {(["magic", "password"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setStatus({ kind: "idle" });
            }}
            className={`py-2.5 ${mode === m ? "bg-crimson/15 text-blood" : "text-muted hover:text-white"}`}
          >
            {m === "magic" ? "Email link" : "Password"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Purchase email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />
        </Field>
        {mode === "password" && (
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />
          </Field>
        )}
        <FormStatus status={status} />
        <button className="btn-primary w-full" disabled={status.kind === "loading"}>
          {mode === "magic" ? "Send sign-in link" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-xs text-dim">
        Accounts are created automatically when you buy. Use the email from your purchase. You can set a password after signing in.
      </p>
    </div>
  );
}

function Dashboard({ me, onChange }: { me: Me; onChange: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const r = await api<{ items: Order[] }>("/account/orders");
    setOrders(r.items);
  }, []);
  useEffect(() => {
    loadOrders().catch(() => setOrders([]));
  }, [loadOrders]);

  async function download(o: Order) {
    try {
      const r = await api<{ url: string }>(`/account/orders/${o.id}/download-link`, { method: "POST" });
      window.location.assign(r.url);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    onChange();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section>
        <h2 className="h-display mb-4 text-xl">Purchases</h2>
        {flash && <div className="mb-4 border border-blood/50 bg-blood/5 px-4 py-2 text-sm text-blood">! {flash}</div>}
        {orders === null ? (
          <div className="text-sm text-muted">loading…</div>
        ) : orders.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No purchases yet. <Link href="/store" className="text-blood">Browse the store →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-bold uppercase text-white">{o.product_name}</div>
                    <div className="mt-1 text-xs text-dim">
                      {dateTime(o.paid_at)} · {money(o.amount_cents, o.currency)} ·{" "}
                      <span className={o.status === "paid" ? "text-ok" : "text-amber"}>{o.status}</span>
                    </div>
                  </div>
                  {o.status === "paid" && o.has_download && (
                    <button onClick={() => download(o)} className="btn-primary btn-sm">
                      ⬇ Download
                    </button>
                  )}
                </div>
                {o.is_hosted && o.status === "paid" && <HostingPanel order={o} onSaved={loadOrders} />}
              </div>
            ))}
          </div>
        )}
      </section>
      <aside className="space-y-4">
        <div className="card p-5 text-sm">
          <div className="label">Signed in as</div>
          <div className="break-all text-white">{me.email}</div>
          <button onClick={logout} className="btn-ghost btn-sm mt-4">
            Sign out
          </button>
        </div>
        <PasswordPanel me={me} onSaved={onChange} />
      </aside>
    </div>
  );
}

function HostingPanel({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const [serverId, setServerId] = useState(order.hosting_server_id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const locked = ["approved", "deployed"].includes(order.hosting_status);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{15,22}$/.test(serverId)) return setMsg("Server IDs are 15–22 digits (enable Developer Mode → right-click server → Copy ID).");
    try {
      await api(`/account/orders/${order.id}/hosting`, { method: "POST", json: { server_id: serverId } });
      setMsg("Submitted. You'll get an email once it's approved.");
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <form onSubmit={save} className="mt-4 border-t border-line pt-4">
      <div className="label">
        Hosted bot · status: <span className="text-amber">{order.hosting_status}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={serverId} onChange={(e) => setServerId(e.target.value.trim())} disabled={locked} placeholder="Discord server ID" className="input" />
        {!locked && <button className="btn-ghost btn-sm">Submit</button>}
      </div>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </form>
  );
}

function PasswordPanel({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ok" | "error"; message?: string }>({ kind: "idle" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ new_password: next, current_password: current || undefined });
    if (!parsed.success) return setStatus({ kind: "error", message: parsed.error.issues[0].message });
    setStatus({ kind: "loading" });
    try {
      await api("/account/password", { method: "POST", json: parsed.data });
      setStatus({ kind: "ok", message: "Password saved." });
      setCurrent("");
      setNext("");
      onSaved();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof ApiError ? err.message : "Failed" });
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-5">
      <div className="label">{me.has_password ? "Change password" : "Set a password (optional)"}</div>
      {me.has_password && (
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" className="input" autoComplete="current-password" />
      )}
      <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (10+ chars)" className="input" autoComplete="new-password" />
      <FormStatus status={status} />
      <button className="btn-ghost btn-sm" disabled={status.kind === "loading"}>
        Save
      </button>
    </form>
  );
}
