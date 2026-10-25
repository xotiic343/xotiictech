"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, PageTitle, adminCall, useAdmin, useNotice } from "@/components/admin/kit";
import { Backups, Logs, MemberPull, Moderation, Overview, Protection, Settings, Verification, type GuildDetail } from "@/components/admin/security";
import { timeAgo } from "@/lib/format";

const TABS = ["Overview", "Logs", "Moderation", "Protection", "Verification", "Member Pull", "Backups", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function SecurityGuildPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: g, error, reload } = useAdmin<GuildDetail>(`/security/guilds/${guildId}`);
  const { notice, ok, fail } = useNotice();
  const [tab, setTab] = useState<Tab>("Overview");
  const [busy, setBusy] = useState(false);

  // The bot re-reports every minute (and right after each action); keep the view fresh.
  useEffect(() => {
    const t = setInterval(() => !document.hidden && reload(), 30_000);
    return () => clearInterval(t);
  }, [reload]);

  /** Queue an action for the bot and wait for its answer. Returns the bot's result. */
  const act = useCallback(
    async (kind: string, payload: Record<string, unknown> = {}, done?: string) => {
      setBusy(true);
      try {
        const r = await adminCall<{ result: unknown }>(`/security/guilds/${guildId}/action`, "POST", { kind, payload });
        if (done) ok(done);
        await reload();
        return r.result;
      } catch (e) {
        fail(e);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [guildId, ok, fail, reload],
  );
  const safeAct = useCallback((kind: string, payload?: Record<string, unknown>, done?: string) => act(kind, payload, done).catch(() => undefined), [act]);

  if (error) return <div className="text-sm text-blood">! {error}</div>;
  if (!g) return <div className="text-sm text-dim">Loading…</div>;
  const ready = Boolean(g.state.config);

  return (
    <div className="space-y-6">
      {notice}
      <Link href="/xotiic/security" className="text-xs uppercase tracking-[0.2em] text-blood hover:text-white">
        ← All servers
      </Link>
      <PageTitle title={g.name}>
        <Badge tone={g.online ? "ok" : "bad"}>{g.online ? "bot online" : "bot offline"}</Badge>
        <span className="text-[11px] uppercase tracking-wider text-dim">reported {timeAgo(g.updated_at)}</span>
        {busy && <span className="text-[11px] uppercase tracking-wider text-amber">working…</span>}
      </PageTitle>
      {!g.online && <div className="border border-blood/40 bg-blood/5 px-4 py-3 text-xs text-blood">The bot hasn&apos;t reported in 3 minutes, so actions won&apos;t run. Check Discloud.</div>}

      <nav className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs uppercase tracking-[0.15em] transition ${
              tab === t ? "border-blood text-blood" : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {!ready && tab !== "Logs" ? (
        <p className="text-sm text-dim">Waiting for the bot&apos;s first report for this server…</p>
      ) : (
        <>
          {tab === "Overview" && <Overview g={g} act={safeAct} />}
          {tab === "Logs" && <Logs guildId={g.id} />}
          {tab === "Moderation" && <Moderation g={g} act={safeAct} />}
          {/* Forms keep their own state; key by server so unsaved edits survive the 30s refresh. */}
          {tab === "Protection" && <Protection key={g.id} g={g} act={safeAct} />}
          {tab === "Verification" && <Verification key={g.id} g={g} act={safeAct} />}
          {tab === "Member Pull" && <MemberPull g={g} onNotice={{ ok, fail }} />}
          {tab === "Backups" && <Backups g={g} act={safeAct} onNotice={{ ok, fail }} />}
          {tab === "Settings" && <Settings key={g.id} g={g} act={safeAct} />}
        </>
      )}
    </div>
  );
}
