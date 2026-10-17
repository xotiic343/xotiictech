"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, PageTitle, Panel, Table, adminCall, statusTone, useAdmin, useNotice } from "@/components/admin/kit";
import { compact, dateTime, timeAgo } from "@/lib/format";

type AdminBot = {
  id: number;
  slug: string;
  name: string;
  username: string;
  avatar_url: string;
  status: string;
  guild_count: number;
  commands: unknown[];
  is_published: boolean;
  is_hidden: boolean;
  is_featured: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  first_seen_at: string;
  app_description: string | null;
};
type SyncLog = {
  id: number;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  bots_seen: number;
  bots_new: number;
  bots_failed: number;
  errors: { token: string; error: string }[];
};
type BotsResponse = {
  items: AdminBot[];
  sync: { running: boolean; last: SyncLog | null; next_run_at: string | null; interval_minutes: number; auto_publish: boolean };
};
type Token = {
  id: number;
  hint: string;
  position: number | null;
  status: string;
  bot_username: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  configured: boolean;
};

const TABS = ["fleet", "inbox", "tokens", "sync log"] as const;

export default function BotsAdmin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("fleet");
  const bots = useAdmin<BotsResponse>("/bots");
  const tokens = useAdmin<{ items: Token[]; configured_count: number; unsynced_count: number }>(tab === "tokens" ? "/bots/tokens" : null);
  const logs = useAdmin<{ items: SyncLog[] }>(tab === "sync log" ? "/bots/sync-logs" : null);
  const { notice, ok, fail } = useNotice();
  const [syncing, setSyncing] = useState(false);
  const prevLogId = useRef<number | null>(null);

  const inbox = (bots.data?.items ?? []).filter((b) => !b.is_published && !b.is_hidden);
  const running = syncing || bots.data?.sync.running;

  const reloadBots = bots.reload;
  const reloadTokens = tokens.reload;
  const reloadLogs = logs.reload;

  // Poll while a sync is running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reloadBots, 2500);
    return () => clearInterval(t);
  }, [running, reloadBots]);
  useEffect(() => {
    if (syncing && bots.data && !bots.data.sync.running) {
      const last = bots.data.sync.last;
      if (last && last.finished_at && last.id !== prevLogId.current) {
        setSyncing(false);
        ok(`Sync ${last.status}: ${last.bots_seen} bots, ${last.bots_new} new, ${last.bots_failed} failed`);
        reloadTokens();
        reloadLogs();
      }
    }
  }, [bots.data, syncing, ok, reloadTokens, reloadLogs]);

  async function syncNow() {
    prevLogId.current = bots.data?.sync.last?.id ?? null;
    try {
      const r = await adminCall<{ started: boolean; message?: string }>("/bots/sync", "POST");
      if (!r.started) ok(r.message ?? "Already running");
      setSyncing(true);
      setTimeout(() => bots.reload(), 800);
    } catch (e) {
      fail(e);
    }
  }

  async function publish(b: AdminBot, on: boolean) {
    try {
      await adminCall(`/bots/${b.id}/${on ? "publish" : "unpublish"}`, "POST");
      ok(`${b.name} ${on ? "published" : "unpublished"}`);
      bots.reload();
    } catch (e) {
      fail(e);
    }
  }

  const sync = bots.data?.sync;

  return (
    <div className="space-y-6">
      <PageTitle title="Bots manager">
        <button className="btn-primary btn-sm" onClick={syncNow} disabled={!!running}>
          {running ? "⟳ Syncing…" : "⟳ Sync now"}
        </button>
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Bots" value={bots.data?.items.length ?? "—"} />
        <Stat label="Unpublished inbox" value={inbox.length} hot={inbox.length > 0} />
        <Stat label="Last sync" value={sync?.last ? timeAgo(sync.last.finished_at ?? sync.last.started_at) : "never"} sub={sync?.last?.status} />
        <Stat label="Next scheduled" value={sync?.next_run_at ? timeAgo(sync.next_run_at).replace(" ago", "") : "—"} sub={`every ${sync?.interval_minutes ?? "?"} min`} />
      </div>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs uppercase tracking-[0.18em] ${tab === t ? "border-blood text-blood" : "border-transparent text-muted hover:text-white"}`}
          >
            {t}
            {t === "inbox" && inbox.length > 0 && <span className="ml-2 bg-blood px-1.5 text-[10px] text-black">{inbox.length}</span>}
          </button>
        ))}
      </div>

      {tab === "fleet" && (
        <Panel>
          <Table head={["Bot", "Status", "Servers", "Cmds", "Synced", "Visibility", ""]} empty={!bots.data?.items.length}>
            {(bots.data?.items ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-panel">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.avatar_url} alt="" className="h-8 w-8 border border-edge" />
                    <div>
                      <div className="text-white">{b.name}</div>
                      <div className="text-[11px] text-dim">/{b.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  {b.last_error && <div className="mt-1 max-w-[200px] truncate text-[11px] text-blood" title={b.last_error}>{b.last_error}</div>}
                </td>
                <td className="px-4 py-3">{compact(b.guild_count)}</td>
                <td className="px-4 py-3">{b.commands.length}</td>
                <td className="px-4 py-3 text-xs text-muted">{timeAgo(b.last_synced_at)}</td>
                <td className="space-x-1 px-4 py-3">
                  {b.is_published ? <Badge tone="ok">live</Badge> : <Badge>unpublished</Badge>}
                  {b.is_hidden && <Badge tone="bad">hidden</Badge>}
                  {b.is_featured && <Badge tone="warn">featured</Badge>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                  <button onClick={() => publish(b, !b.is_published)} className="mr-3 text-muted hover:text-white">
                    {b.is_published ? "unpublish" : "publish"}
                  </button>
                  <Link href={`/xotiic/bots/${b.id}`} className="text-blood hover:text-white">
                    edit →
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {tab === "inbox" && (
        <div className="space-y-3">
          {sync && (
            <p className="text-xs text-muted">
              New bots discovered by sync land here. Auto-publish is <span className={sync.auto_publish ? "text-ok" : "text-amber"}>{sync.auto_publish ? "ON" : "OFF"}</span> (change in Settings).
            </p>
          )}
          {inbox.map((b) => (
            <div key={b.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.avatar_url} alt="" className="h-14 w-14 border border-edge" />
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold uppercase text-white">{b.name}</div>
                <div className="text-xs text-dim">
                  discovered {timeAgo(b.first_seen_at)} · {compact(b.guild_count)} servers · {b.commands.length} commands
                </div>
                {b.app_description && <p className="mt-1 line-clamp-2 text-sm text-muted">{b.app_description}</p>}
              </div>
              <div className="flex gap-2">
                <Link href={`/xotiic/bots/${b.id}`} className="btn-ghost btn-sm">
                  Review
                </Link>
                <button onClick={() => publish(b, true)} className="btn-primary btn-sm">
                  Publish
                </button>
              </div>
            </div>
          ))}
          {!inbox.length && <div className="card p-10 text-center text-sm text-dim">Inbox zero. New bots appear here after a sync.</div>}
        </div>
      )}

      {tab === "tokens" && (
        <Panel title={`Configured tokens: ${tokens.data?.configured_count ?? "…"}${tokens.data?.unsynced_count ? ` · ${tokens.data.unsynced_count} not yet checked (run a sync)` : ""}`}>
          <Table head={["Token", "Bot", "Health", "Checked", "Error"]} empty={!tokens.data?.items.length}>
            {(tokens.data?.items ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs text-white">{t.hint}</td>
                <td className="px-4 py-3">{t.bot_username ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{dateTime(t.last_checked_at)}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-blood">{t.last_error ?? ""}</td>
              </tr>
            ))}
          </Table>
          <p className="border-t border-line px-4 py-3 text-[11px] text-dim">
            Raw tokens never leave the server. To rotate: reset the token in the Discord Developer Portal → update DISCORD_BOT_TOKENS in Render → redeploy → Sync now.
          </p>
        </Panel>
      )}

      {tab === "sync log" && (
        <Panel>
          <Table head={["Started", "Trigger", "Result", "Seen", "New", "Failed", "Errors"]} empty={!logs.data?.items.length}>
            {(logs.data?.items ?? []).map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-xs">{dateTime(l.started_at)}</td>
                <td className="px-4 py-3 text-xs text-muted">{l.trigger}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                </td>
                <td className="px-4 py-3">{l.bots_seen}</td>
                <td className="px-4 py-3">{l.bots_new}</td>
                <td className="px-4 py-3">{l.bots_failed}</td>
                <td className="px-4 py-3 text-xs text-blood">{l.errors.map((e) => `${e.token}: ${e.error}`).join(" · ")}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      {notice}
    </div>
  );
}

function Stat({ label, value, sub, hot }: { label: string; value: React.ReactNode; sub?: string; hot?: boolean }) {
  return (
    <div className={`border bg-ink p-4 ${hot ? "border-blood shadow-neon" : "border-line"}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{label}</div>
      <div className="mt-1 font-display text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
