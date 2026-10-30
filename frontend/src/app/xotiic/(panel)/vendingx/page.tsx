"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, PageTitle, Panel, Table, useNotice } from "@/components/admin/kit";
import { timeAgo } from "@/lib/format";

async function vx<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/vendingx/api${path}`, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function useVx<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await vx<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

type Stats = {
  total_users: number;
  total_vends: number;
  total_payments: number;
  vends_today: number;
  total_stock: number;
  top_types: { type: string; name: string; count: number }[];
};

type StockInfo = Record<string, { name: string; description: string; count: number; premium: boolean }>;
type FeedEntry = { username: string; category: string; source: string; time: string };
type UserRow = { id: number; username: string; total_generated: number; last_generated: string | null };
type ConfigRow = {
  server_id: number;
  log_channel_id: number | null;
  announce_channel_id: number | null;
  announce_role_id: number | null;
  auto_update_channel_id: number | null;
  auto_update_role_id: number | null;
};
type BannedRow = { user_id: number; reason: string | null; banned_at: string };

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line bg-ink px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

export default function VendingXAdmin() {
  const stats = useVx<Stats>("/admin/stats");
  const stockData = useVx<StockInfo>("/stock");
  const feed = useVx<FeedEntry[]>("/feed");
  const users = useVx<UserRow[]>("/admin/users");
  const config = useVx<ConfigRow[]>("/admin/config");
  const banned = useVx<BannedRow[]>("/admin/banned");
  const { notice, ok, fail } = useNotice();

  const [uploadType, setUploadType] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadType) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("stock_type", uploadType);
      form.append("file", file);
      const res = await vx<{ added: number; total: number }>("/admin/upload", {
        method: "POST",
        body: form,
      });
      ok(`Added ${res.added} entries (${res.total} total)`);
      stockData.reload();
      stats.reload();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      fail(e);
    } finally {
      setUploading(false);
    }
  }

  function reloadAll() {
    stats.reload();
    stockData.reload();
    feed.reload();
    users.reload();
    config.reload();
    banned.reload();
  }

  const stockEntries = stockData.data
    ? Object.entries(stockData.data).sort(([a], [b]) => a.localeCompare(b))
    : [];

  const apiDown = stats.error && stockData.error;

  return (
    <div className="space-y-6">
      <PageTitle title="Vending X">
        <a href="/vendingx" target="_blank" className="btn-ghost btn-sm">
          View page ↗
        </a>
        <button className="btn-ghost btn-sm" onClick={reloadAll}>
          Refresh
        </button>
      </PageTitle>

      {apiDown && (
        <div className="border border-blood/40 bg-blood/5 px-4 py-3 text-xs text-blood">
          Vending X API unreachable — make sure the bot is running on Discloud and VENDINGX_URL is set.
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Users" value={stats.data?.total_users ?? "—"} />
        <Tile label="Total vends" value={stats.data?.total_vends ?? "—"} />
        <Tile label="Today" value={stats.data?.vends_today ?? "—"} />
        <Tile label="Stock items" value={stats.data?.total_stock ?? "—"} />
        <Tile label="Payments" value={stats.data?.total_payments ?? "—"} />
      </div>

      {/* ── Upload stock ── */}
      <Panel title="Upload stock">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-dim">
              Stock type
            </label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full border border-edge bg-black px-3 py-2 text-sm text-white focus:border-crimson focus:outline-none"
            >
              <option value="">Select type...</option>
              {stockEntries.map(([key, info]) => (
                <option key={key} value={key}>
                  {info.premium ? "[P] " : ""}
                  {info.name} ({info.count})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-dim">
              .txt file
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              className="w-full border border-edge bg-black px-3 py-2 text-sm text-white file:mr-3 file:border-0 file:bg-crimson/20 file:px-3 file:py-1 file:text-xs file:text-blood focus:border-crimson focus:outline-none"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || !uploadType}
            className="border border-crimson bg-crimson/10 px-6 py-2 text-sm font-bold uppercase tracking-wider text-blood transition hover:bg-crimson/20 disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        <p className="border-t border-line px-4 py-2 text-[10px] text-dim">
          Any .txt layout — user:pass, email:pass, URL lists, numbered, pipe-separated, tab-separated, etc. The parser auto-detects the format.
        </p>
      </Panel>

      {/* ── Stock inventory ── */}
      <Panel title="Stock inventory">
        <Table
          head={["Type", "Name", "Tier", "Count", "Status"]}
          empty={!stockData.loading && !stockEntries.length}
        >
          {stockEntries.map(([key, info]) => (
            <tr key={key} className="hover:bg-crimson/5">
              <td className="px-4 py-2.5 font-mono text-xs text-dim">{key}</td>
              <td className="px-4 py-2.5 text-white">{info.name}</td>
              <td className="px-4 py-2.5">
                <Badge tone={info.premium ? "warn" : "muted"}>
                  {info.premium ? "premium" : "regular"}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-mono">{info.count}</td>
              <td className="px-4 py-2.5">
                <Badge tone={info.count > 0 ? "ok" : "bad"}>
                  {info.count > 0 ? "stocked" : "empty"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      {/* ── Recent vends ── */}
      <Panel title="Recent vends">
        <Table
          head={["User", "Category", "Source", "Time"]}
          empty={!feed.loading && !feed.data?.length}
        >
          {feed.data?.map((f, i) => (
            <tr key={i} className="hover:bg-crimson/5">
              <td className="px-4 py-2.5 text-white">{f.username}</td>
              <td className="px-4 py-2.5">{f.category}</td>
              <td className="px-4 py-2.5">
                <Badge tone={f.source === "BOT" ? "info" : "warn"}>{f.source}</Badge>
              </td>
              <td className="px-4 py-2.5 text-dim">{timeAgo(f.time)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      {/* ── Top vended types ── */}
      {stats.data?.top_types && stats.data.top_types.length > 0 && (
        <Panel title="Most vended">
          <Table head={["Type", "Vends"]}>
            {stats.data.top_types.map((t) => (
              <tr key={t.type} className="hover:bg-crimson/5">
                <td className="px-4 py-2.5 text-white">{t.name}</td>
                <td className="px-4 py-2.5 font-mono">{t.count}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {/* ── Top users ── */}
      <Panel title="Top users">
        <Table
          head={["User ID", "Username", "Vends", "Last active"]}
          empty={!users.loading && !users.data?.length}
        >
          {users.data?.map((u) => (
            <tr key={u.id} className="hover:bg-crimson/5">
              <td className="px-4 py-2.5 font-mono text-xs text-dim">{u.id}</td>
              <td className="px-4 py-2.5 text-white">{u.username}</td>
              <td className="px-4 py-2.5 font-mono">{u.total_generated}</td>
              <td className="px-4 py-2.5 text-dim">
                {u.last_generated ? timeAgo(u.last_generated) : "—"}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      {/* ── Server config ── */}
      <Panel title="Server config">
        {config.data && config.data.length === 0 && (
          <div className="px-4 py-3 text-xs text-dim">
            No servers configured yet. Use /config in Discord to set up channels.
          </div>
        )}
        {config.data && config.data.length > 0 && (
          <Table
            head={[
              "Server ID",
              "Log channel",
              "Announce channel",
              "Announce role",
              "Auto-update ch",
              "Auto-update role",
            ]}
          >
            {config.data.map((c) => (
              <tr key={c.server_id} className="hover:bg-crimson/5">
                <td className="px-4 py-2.5 font-mono text-xs text-dim">{c.server_id}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {c.log_channel_id || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {c.announce_channel_id || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {c.announce_role_id || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {c.auto_update_channel_id || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {c.auto_update_role_id || "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      {/* ── Banned users ── */}
      <Panel title="Banned users">
        <Table
          head={["User ID", "Reason", "Banned at"]}
          empty={!banned.loading && !banned.data?.length}
        >
          {banned.data?.map((b) => (
            <tr key={b.user_id} className="hover:bg-crimson/5">
              <td className="px-4 py-2.5 font-mono text-xs text-dim">{b.user_id}</td>
              <td className="px-4 py-2.5 text-white">{b.reason || "—"}</td>
              <td className="px-4 py-2.5 text-dim">{timeAgo(b.banned_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      {notice}
    </div>
  );
}
