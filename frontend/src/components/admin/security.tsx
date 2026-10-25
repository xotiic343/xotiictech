"use client";

// Security X control panel tabs (/xotiic/security/[guildId]). Everything here reads the snapshot the bot
// pushes every minute and sends actions through /admin/security/guilds/:id/action (queued for the bot).
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Panel, Table, Toggle, adminCall, statusTone, useAdmin } from "@/components/admin/kit";
import { timeAgo } from "@/lib/format";

/* ───────────────────────────── types ───────────────────────────── */

export type Channel = { id: string; name: string; type: "text" | "voice" | "category" };
export type Role = { id: string; name: string; color: string; managed: boolean };
export type SxConfig = {
  modules: Record<"logging" | "automod" | "antiraid" | "antinuke" | "verification", boolean>;
  logs: Record<"mod" | "join" | "message" | "voice", string | null>;
  jail: { roleId: string | null; textChannelId: string | null; voiceChannelId: string | null };
  verify: { channelId: string | null; roleId: string | null; mode: "web" | "button" | "captcha" };
  autoroles: string[];
  antiraid: { joins: number; seconds: number; kickDuringRaid: boolean };
  antinuke: { limit: number; seconds: number; punishment: "strip" | "kick" | "ban" };
  automod: { invites: boolean; links: boolean; caps: boolean; spam: boolean; mentions: number; words: string[] };
  raidmode: { active: boolean; lockedChannels: string[] };
  reportChannelId: string | null;
};
export type GuildDetail = {
  id: string;
  name: string;
  icon: string | null;
  members: number;
  online: boolean;
  updated_at: string;
  verified: number;
  verify_url: string;
  state: {
    config?: SxConfig;
    jails?: { userId: string; roles: number; reason: string | null; modId: string; jailedAt: number }[];
    cases?: { id: number; number: number; action: string; user_id: string; mod_id: string; reason: string | null; created_at: number }[];
    warnings?: { id: number; user_id: string; mod_id: string; reason: string | null; created_at: number }[];
    backups?: { id: string; name: string; created_by: string; created_at: number; size: number }[];
    whitelist?: { target_id: string; type: string; added_at: number }[];
    channels?: Channel[];
    roles?: Role[];
  };
};
export type Act = (kind: string, payload?: Record<string, unknown>, done?: string) => Promise<unknown>;

const when = (ms: number | string) => new Date(ms).toLocaleString("en", { dateStyle: "short", timeStyle: "short" });
const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
const field = "input py-1.5 text-xs";

function ChannelSelect({ value, onChange, channels, type = "text", none = "off" }: { value: string | null; onChange: (v: string | null) => void; channels: Channel[]; type?: Channel["type"]; none?: string }) {
  return (
    <select className={field} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{none}</option>
      {channels.filter((c) => c.type === type).map((c) => (
        <option key={c.id} value={c.id}>
          {type === "voice" ? "◉ " : "# "}
          {c.name}
        </option>
      ))}
    </select>
  );
}

function RoleSelect({ value, onChange, roles }: { value: string | null; onChange: (v: string | null) => void; roles: Role[] }) {
  return (
    <select className={field} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">none</option>
      {roles.filter((r) => !r.managed).map((r) => (
        <option key={r.id} value={r.id}>
          @{r.name}
        </option>
      ))}
    </select>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid items-center gap-2 py-2 sm:grid-cols-[200px_1fr]">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</span>
      <span>{children}</span>
    </label>
  );
}

/* ──────────────────────────── overview ─────────────────────────── */

export function Overview({ g, act }: { g: GuildDetail; act: Act }) {
  const cfg = g.state.config;
  if (!cfg) return <p className="text-sm text-dim">Waiting for the bot&apos;s first report...</p>;
  const stats: [string, string | number][] = [
    ["Members", g.members.toLocaleString("en")],
    ["Verified (consent)", g.verified],
    ["Jailed", g.state.jails?.length ?? 0],
    ["Backups", g.state.backups?.length ?? 0],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="border border-line bg-ink p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{k}</div>
            <div className="mt-1 font-display text-2xl font-black text-white">{v}</div>
          </div>
        ))}
      </div>
      <Panel
        title="Raid mode"
        actions={
          <button
            className={cfg.raidmode.active ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
            onClick={() => {
              if (cfg.raidmode.active || confirm("Lock every channel and raise verification to High?")) {
                act("raidmode", { on: !cfg.raidmode.active }, cfg.raidmode.active ? "Raid mode off" : "Raid mode on");
              }
            }}
          >
            {cfg.raidmode.active ? "Turn off" : "Lockdown now"}
          </button>
        }
      >
        <div className="px-4 py-3 text-sm">
          {cfg.raidmode.active ? <Badge tone="bad">active: {cfg.raidmode.lockedChannels.length} channels locked</Badge> : <Badge tone="ok">off</Badge>}
        </div>
      </Panel>
      <Panel title="Modules">
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {(Object.keys(cfg.modules) as (keyof SxConfig["modules"])[]).map((m) => (
            <Toggle key={m} checked={cfg.modules[m]} label={m} onChange={(v) => act("config.patch", { patch: { modules: { [m]: v } } }, `${m} ${v ? "on" : "off"}`)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ────────────────────────────── logs ───────────────────────────── */

type LogItem = { id: number; type: string; summary: string; at: string };
const LOG_TONE: Record<string, "ok" | "warn" | "bad" | "muted" | "info"> = { alert: "bad", mod: "warn", join: "ok", message: "info", voice: "muted" };

export function Logs({ guildId }: { guildId: string }) {
  const [type, setType] = useState("");
  const [items, setItems] = useState<LogItem[]>([]);
  const [paused, setPaused] = useState(false);
  const last = useRef(0);

  const load = useCallback(
    async (initial: boolean) => {
      const q = new URLSearchParams({ limit: "150", ...(type ? { type } : {}), ...(!initial && last.current ? { after: String(last.current) } : {}) });
      const r = await adminCall<{ items: LogItem[] }>(`/security/guilds/${guildId}/logs?${q}`, "GET");
      if (r.items.length) last.current = r.items[r.items.length - 1].id;
      setItems((prev) => (initial ? r.items.reverse() : [...r.items.reverse(), ...prev]).slice(0, 500));
    },
    [guildId, type],
  );

  useEffect(() => {
    last.current = 0;
    load(true).catch(() => undefined);
  }, [load]);

  // Live: new entries every 3 seconds while the tab is open and not paused.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      if (!document.hidden) load(false).catch(() => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [load, paused]);

  return (
    <Panel
      title="Live logs"
      actions={
        <div className="flex items-center gap-2">
          <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">all</option>
            {["alert", "mod", "join", "message", "voice"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className="btn-ghost btn-sm" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      }
    >
      <ol className="max-h-[60vh] divide-y divide-line overflow-y-auto font-mono text-xs">
        {items.map((l) => (
          <li key={l.id} className="flex gap-3 px-4 py-2">
            <span className="shrink-0 text-dim">{new Date(l.at).toLocaleTimeString("en")}</span>
            <span className="shrink-0">
              <Badge tone={LOG_TONE[l.type] ?? "muted"}>{l.type}</Badge>
            </span>
            <span className="min-w-0 break-words text-neutral-300">{l.summary}</span>
          </li>
        ))}
        {!items.length && <li className="px-4 py-10 text-center text-dim">No log entries yet.</li>}
      </ol>
    </Panel>
  );
}

/* ─────────────────────────── moderation ────────────────────────── */

export function Moderation({ g, act }: { g: GuildDetail; act: Act }) {
  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState("jail");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("10m");

  return (
    <div className="space-y-6">
      <Panel title="Take action">
        <div className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_1fr_auto_auto]">
          <input className={field} placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value.trim())} />
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            {["jail", "unjail", "timeout", "kick", "ban", "unban"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input className={field} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          {kind === "timeout" ? <input className={`${field} w-24`} value={duration} onChange={(e) => setDuration(e.target.value)} /> : <span />}
          <button
            className="btn-primary btn-sm"
            disabled={!/^\d{5,25}$/.test(userId)}
            onClick={() => {
              if (["ban", "kick"].includes(kind) && !confirm(`${kind} ${userId}?`)) return;
              act(kind, { userId, reason, duration }, `${kind} done`);
            }}
          >
            Run
          </button>
        </div>
        {!g.state.config?.jail.roleId && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-amber">
            Jail isn&apos;t set up yet.
            <button className="btn-ghost btn-sm" onClick={() => act("jail.setup", {}, "Jail created")}>
              Set up jail
            </button>
          </div>
        )}
      </Panel>

      <Panel title={`Jailed (${g.state.jails?.length ?? 0})`}>
        <Table head={["User", "Roles saved", "Reason", "Since", ""]} empty={!g.state.jails?.length}>
          {g.state.jails?.map((j) => (
            <tr key={j.userId}>
              <td className="px-4 py-2 font-mono text-xs">{j.userId}</td>
              <td className="px-4 py-2">{j.roles}</td>
              <td className="px-4 py-2 text-muted">{j.reason || "—"}</td>
              <td className="px-4 py-2 text-dim">{when(j.jailedAt)}</td>
              <td className="px-4 py-2 text-right">
                <button className="btn-ghost btn-sm" onClick={() => act("unjail", { userId: j.userId, reason: "released from panel" }, "Unjailed")}>
                  Unjail
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Recent cases">
        <Table head={["#", "Action", "User", "Moderator", "Reason", "When"]} empty={!g.state.cases?.length}>
          {g.state.cases?.slice(0, 50).map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 text-blood">#{c.number}</td>
              <td className="px-4 py-2">
                <Badge tone={c.action.startsWith("un") ? "ok" : "warn"}>{c.action}</Badge>
              </td>
              <td className="px-4 py-2 font-mono text-xs">{c.user_id}</td>
              <td className="px-4 py-2 font-mono text-xs text-dim">{c.mod_id}</td>
              <td className="max-w-xs truncate px-4 py-2 text-muted">{c.reason || "—"}</td>
              <td className="px-4 py-2 text-dim">{when(c.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Recent warnings">
        <Table head={["User", "Reason", "When", ""]} empty={!g.state.warnings?.length}>
          {g.state.warnings?.slice(0, 50).map((w) => (
            <tr key={w.id}>
              <td className="px-4 py-2 font-mono text-xs">{w.user_id}</td>
              <td className="px-4 py-2 text-muted">{w.reason || "—"}</td>
              <td className="px-4 py-2 text-dim">{when(w.created_at)}</td>
              <td className="px-4 py-2 text-right">
                <button className="btn-sm text-blood hover:text-white" onClick={() => act("warnings.clear", { userId: w.user_id }, "Warnings cleared")}>
                  clear user
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── protection ────────────────────────── */

export function Protection({ g, act }: { g: GuildDetail; act: Act }) {
  const cfg = g.state.config!;
  const [raid, setRaid] = useState(cfg.antiraid);
  const [nuke, setNuke] = useState(cfg.antinuke);
  const [auto, setAuto] = useState(cfg.automod);
  const [words, setWords] = useState(cfg.automod.words.join("\n"));
  const [wlId, setWlId] = useState("");
  const [wlType, setWlType] = useState("user");
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));

  return (
    <div className="space-y-6">
      <Panel title="Anti-raid" actions={<Toggle checked={cfg.modules.antiraid} label="on" onChange={(v) => act("config.patch", { patch: { modules: { antiraid: v } } })} />}>
        <div className="divide-y divide-line px-4">
          <Row label="Joins that trigger raid mode">
            <input type="number" className={`${field} w-24`} value={raid.joins} onChange={(e) => setRaid({ ...raid, joins: num(e.target.value, 3, 100) })} />
          </Row>
          <Row label="Within seconds">
            <input type="number" className={`${field} w-24`} value={raid.seconds} onChange={(e) => setRaid({ ...raid, seconds: num(e.target.value, 3, 300) })} />
          </Row>
          <Row label="Kick joins during raid">
            <Toggle checked={raid.kickDuringRaid} label="" onChange={(v) => setRaid({ ...raid, kickDuringRaid: v })} />
          </Row>
          <div className="py-3 text-right">
            <button className="btn-primary btn-sm" onClick={() => act("config.patch", { patch: { antiraid: raid } }, "Anti-raid saved")}>
              Save
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Anti-nuke" actions={<Toggle checked={cfg.modules.antinuke} label="on" onChange={(v) => act("config.patch", { patch: { modules: { antinuke: v } } })} />}>
        <div className="divide-y divide-line px-4">
          <Row label="Destructive actions allowed">
            <input type="number" className={`${field} w-24`} value={nuke.limit} onChange={(e) => setNuke({ ...nuke, limit: num(e.target.value, 2, 50) })} />
          </Row>
          <Row label="Within seconds">
            <input type="number" className={`${field} w-24`} value={nuke.seconds} onChange={(e) => setNuke({ ...nuke, seconds: num(e.target.value, 3, 300) })} />
          </Row>
          <Row label="Punishment">
            <select className={field} value={nuke.punishment} onChange={(e) => setNuke({ ...nuke, punishment: e.target.value as SxConfig["antinuke"]["punishment"] })}>
              <option value="strip">remove all roles</option>
              <option value="kick">kick</option>
              <option value="ban">ban</option>
            </select>
          </Row>
          <div className="py-3 text-right">
            <button className="btn-primary btn-sm" onClick={() => act("config.patch", { patch: { antinuke: nuke } }, "Anti-nuke saved")}>
              Save
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="AutoMod" actions={<Toggle checked={cfg.modules.automod} label="on" onChange={(v) => act("config.patch", { patch: { modules: { automod: v } } })} />}>
        <div className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {(["invites", "links", "caps", "spam"] as const).map((k) => (
              <Toggle key={k} checked={auto[k]} label={k} onChange={(v) => setAuto({ ...auto, [k]: v })} />
            ))}
          </div>
          <Row label="Max mentions (0 = off)">
            <input type="number" className={`${field} w-24`} value={auto.mentions} onChange={(e) => setAuto({ ...auto, mentions: num(e.target.value, 0, 50) })} />
          </Row>
          <Row label="Blocked words (one per line)">
            <textarea className={`${field} h-24 w-full`} value={words} onChange={(e) => setWords(e.target.value)} />
          </Row>
          <div className="text-right">
            <button
              className="btn-primary btn-sm"
              onClick={() => act("config.patch", { patch: { automod: { ...auto, words: words.split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean).slice(0, 200) } } }, "AutoMod saved")}
            >
              Save
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Whitelist (ignored by anti-nuke and AutoMod)">
        <div className="flex flex-wrap gap-2 border-b border-line p-4">
          <input className={field} placeholder="User or role ID" value={wlId} onChange={(e) => setWlId(e.target.value.trim())} />
          <select className={field} value={wlType} onChange={(e) => setWlType(e.target.value)}>
            <option value="user">user</option>
            <option value="role">role</option>
          </select>
          <button className="btn-primary btn-sm" disabled={!/^\d{5,25}$/.test(wlId)} onClick={() => act("whitelist.add", { targetId: wlId, type: wlType }, "Whitelisted").then(() => setWlId(""))}>
            Add
          </button>
        </div>
        <Table head={["ID", "Type", ""]} empty={!g.state.whitelist?.length}>
          {g.state.whitelist?.map((w) => (
            <tr key={w.target_id}>
              <td className="px-4 py-2 font-mono text-xs">
                {w.target_id} {w.type === "role" && <span className="text-dim">{g.state.roles?.find((r) => r.id === w.target_id)?.name}</span>}
              </td>
              <td className="px-4 py-2">{w.type}</td>
              <td className="px-4 py-2 text-right">
                <button className="btn-sm text-blood hover:text-white" onClick={() => act("whitelist.remove", { targetId: w.target_id }, "Removed")}>
                  remove
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

/* ────────────────────────── verification ───────────────────────── */

type ConsentMember = { user_id: string; username: string; consented_at: string };

export function Verification({ g, act }: { g: GuildDetail; act: Act }) {
  const cfg = g.state.config!;
  const [v, setV] = useState(cfg.verify);
  const [q, setQ] = useState("");
  const members = useAdmin<{ total: number; items: ConsentMember[] }>(`/security/guilds/${g.id}/members?q=${encodeURIComponent(q)}`);

  return (
    <div className="space-y-6">
      <Panel title="Setup">
        <div className="divide-y divide-line px-4">
          <Row label="Mode">
            <select className={field} value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value as SxConfig["verify"]["mode"] })}>
              <option value="web">website + backup consent (enables pulls)</option>
              <option value="button">one button</option>
              <option value="captcha">captcha code</option>
            </select>
          </Row>
          <Row label="Panel channel">
            <ChannelSelect value={v.channelId} onChange={(id) => setV({ ...v, channelId: id })} channels={g.state.channels ?? []} none="choose" />
          </Row>
          <Row label="Verified role">
            <RoleSelect value={v.roleId} onChange={(id) => setV({ ...v, roleId: id })} roles={g.state.roles ?? []} />
          </Row>
          <Row label="Verify page">
            <code className="break-all text-xs text-amber">{g.verify_url}</code>
          </Row>
          <div className="flex justify-end gap-2 py-3">
            <button className="btn-ghost btn-sm" disabled={!cfg.verify.channelId} onClick={() => act("verify.panel", {}, "Panel posted")}>
              Post Verify panel
            </button>
            <button className="btn-primary btn-sm" onClick={() => act("config.patch", { patch: { verify: v, modules: { verification: true } } }, "Verification saved")}>
              Save
            </button>
          </div>
        </div>
      </Panel>

      <Panel
        title={`Consenting members (${members.data?.total ?? 0})`}
        actions={<input className={field} placeholder="Search name or ID" value={q} onChange={(e) => setQ(e.target.value)} />}
      >
        <Table head={["User", "ID", "Agreed", ""]} empty={!members.data?.items.length}>
          {members.data?.items.map((m) => (
            <tr key={m.user_id}>
              <td className="px-4 py-2">{m.username}</td>
              <td className="px-4 py-2 font-mono text-xs text-dim">{m.user_id}</td>
              <td className="px-4 py-2 text-dim">{timeAgo(m.consented_at)}</td>
              <td className="px-4 py-2 text-right">
                <button
                  className="btn-sm text-blood hover:text-white"
                  onClick={async () => {
                    if (!confirm(`Forget ${m.username}'s consent? They won't be pulled anymore.`)) return;
                    await adminCall(`/security/guilds/${g.id}/members/${m.user_id}`, "DELETE");
                    members.reload();
                  }}
                >
                  revoke
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── member pull ───────────────────────── */

type Pull = {
  id: number; source: string; target: string; status: string; max_members: number | null; total: number; processed: number;
  added: number; already: number; failed: number; error: string | null; created_at: string;
  source_name?: string | null; target_name?: string | null;
};
type GuildRow = { id: string; name: string };

export function MemberPull({ g, onNotice }: { g: GuildDetail; onNotice: { ok: (t: string) => void; fail: (e: unknown) => void } }) {
  const pulls = useAdmin<{ worker_ready: boolean; items: Pull[] }>(`/security/pulls?guild=${g.id}`);
  const guilds = useAdmin<{ items: GuildRow[] }>("/security/guilds");
  const [target, setTarget] = useState("");
  const [amountChoice, setAmountChoice] = useState("all");
  const [custom, setCustom] = useState("");
  const amount = amountChoice === "all" ? null : amountChoice === "custom" ? Math.floor(Number(custom)) : Number(amountChoice);
  const amountOk = amount === null || (Number.isFinite(amount) && amount >= 1 && amount <= 1_000_000);
  const pulling = amount === null ? g.verified : Math.min(amount, g.verified);
  const running = pulls.data?.items.some((p) => p.status === "queued" || p.status === "running");
  const { reload } = pulls;

  // Live progress while a pull is running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [running, reload]);

  return (
    <div className="space-y-6">
      <Panel title="Start a pull">
        <div className="space-y-3 p-4 text-sm">
          <p className="text-muted">
            Adds the <strong className="text-white">{g.verified}</strong> member(s) who verified on the website and agreed, from <strong className="text-white">{g.name}</strong> into the
            server you pick. Security X must already be in that server with the Create Invite permission.
          </p>
          {!pulls.data?.worker_ready && <p className="text-xs text-amber">SECURITY_BOT_TOKEN, SECURITY_CLIENT_ID or SECURITY_CLIENT_SECRET is missing on the API service.</p>}
          <div className="flex flex-wrap gap-2">
            <select className={field} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">target server...</option>
              {guilds.data?.items.filter((x) => x.id !== g.id).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <select className={field} value={amountChoice} onChange={(e) => setAmountChoice(e.target.value)} aria-label="How many members">
              <option value="all">All ({g.verified})</option>
              {[10, 25, 50, 75, 100, 500, 1000, 10000].map((n) => (
                <option key={n} value={String(n)}>
                  {n.toLocaleString("en")} members
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {amountChoice === "custom" && (
              <input
                type="number"
                min={1}
                max={1000000}
                className={`${field} w-28`}
                placeholder="amount"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
            <button
              className="btn-primary btn-sm"
              disabled={!target || !pulls.data?.worker_ready || !amountOk}
              onClick={async () => {
                if (!confirm(`Add ${pulling.toLocaleString("en")} consenting member(s) into the selected server?`)) return;
                try {
                  await adminCall("/security/pulls", "POST", { source: g.id, target, amount });
                  onNotice.ok("Pull started");
                  reload();
                } catch (e) {
                  onNotice.fail(e);
                }
              }}
            >
              Start pull
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Pull history">
        <Table head={["#", "From → to", "Status", "Progress", "Added", "Already in", "Failed", ""]} empty={!pulls.data?.items.length}>
          {pulls.data?.items.map((p) => {
            const pct = p.total ? Math.min(100, Math.round((p.processed / p.total) * 100)) : p.status === "done" ? 100 : 0;
            return (
              <tr key={p.id}>
                <td className="px-4 py-2 text-blood">#{p.id}</td>
                <td className="px-4 py-2 text-xs">
                  {p.source_name ?? p.source} → {p.target_name ?? p.target}
                  <div className="text-dim">{p.max_members ? `amount: ${p.max_members.toLocaleString("en")}` : "amount: all"}</div>
                  {p.error && <div className="text-blood">{p.error}</div>}
                </td>
                <td className="px-4 py-2">
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </td>
                <td className="w-40 px-4 py-2">
                  <div className="h-1.5 bg-line">
                    <div className="h-full bg-crimson transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-dim">
                    {p.processed}/{p.total} ({pct}%)
                  </div>
                </td>
                <td className="px-4 py-2 text-ok">{p.added}</td>
                <td className="px-4 py-2">{p.already}</td>
                <td className="px-4 py-2 text-blood">{p.failed}</td>
                <td className="px-4 py-2 text-right">
                  {(p.status === "queued" || p.status === "running") && (
                    <button className="btn-sm text-blood hover:text-white" onClick={() => adminCall(`/security/pulls/${p.id}/cancel`, "POST").then(reload)}>
                      cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </div>
  );
}

/* ──────────────────────────── settings ─────────────────────────── */

export function Settings({ g, act }: { g: GuildDetail; act: Act }) {
  const cfg = g.state.config!;
  const [logs, setLogs] = useState(cfg.logs);
  const [report, setReport] = useState(cfg.reportChannelId);
  const [autoroles, setAutoroles] = useState<string[]>(cfg.autoroles);
  const channels = g.state.channels ?? [];
  const roles = (g.state.roles ?? []).filter((r) => !r.managed);
  const LABELS: Record<keyof SxConfig["logs"], string> = { mod: "Moderation + alerts", join: "Joins / leaves", message: "Message edits / deletes", voice: "Voice activity" };

  return (
    <div className="space-y-6">
      <Panel title="Log channels">
        <div className="divide-y divide-line px-4">
          {(Object.keys(LABELS) as (keyof SxConfig["logs"])[]).map((k) => (
            <Row key={k} label={LABELS[k]}>
              <ChannelSelect value={logs[k]} onChange={(id) => setLogs({ ...logs, [k]: id })} channels={channels} />
            </Row>
          ))}
          <Row label="/report goes to">
            <ChannelSelect value={report} onChange={setReport} channels={channels} none="mod log" />
          </Row>
          <div className="py-3 text-right">
            <button className="btn-primary btn-sm" onClick={() => act("config.patch", { patch: { logs, reportChannelId: report } }, "Logs saved")}>
              Save
            </button>
          </div>
        </div>
      </Panel>
      <Panel title="Auto-roles (given on join)">
        <div className="grid max-h-72 gap-2 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[#e60000]"
                checked={autoroles.includes(r.id)}
                onChange={(e) => setAutoroles(e.target.checked ? [...autoroles, r.id].slice(0, 10) : autoroles.filter((x) => x !== r.id))}
              />
              <span style={{ color: r.color !== "#000000" ? r.color : undefined }}>@{r.name}</span>
            </label>
          ))}
        </div>
        <div className="border-t border-line p-3 text-right">
          <button className="btn-primary btn-sm" onClick={() => act("config.patch", { patch: { autoroles } }, "Auto-roles saved")}>
            Save
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ──────────────────────────── backups ──────────────────────────── */

export function Backups({ g, act, onNotice }: { g: GuildDetail; act: Act; onNotice: { ok: (t: string) => void; fail: (e: unknown) => void } }) {
  const [name, setName] = useState("");
  const [restoreInto, setRestoreInto] = useState(g.id);
  const guilds = useAdmin<{ items: GuildRow[] }>("/security/guilds");

  // Backups can be restored into any server Security X is in, so these go to the TARGET server's endpoint.
  async function restore(id: string) {
    const into = guilds.data?.items.find((x) => x.id === restoreInto)?.name ?? restoreInto;
    try {
      const { result: p } = await adminCall<{ result: Record<string, number> }>(`/security/guilds/${restoreInto}/action`, "POST", { kind: "backup.preview", payload: { id } });
      const summary = `\n\nRoles: ${p.rolesNew} new, ${p.rolesUpdate} updated\nChannels: ${p.channelsNew} new, ${p.channelsUpdate} updated\nEmojis: ${p.emojisNew} new`;
      if (!confirm(`Restore backup ${id} into "${into}"? Nothing is deleted; server name, icon and settings are overwritten.${summary}`)) return;
      await adminCall(`/security/guilds/${restoreInto}/action`, "POST", { kind: "backup.restore", payload: { id } });
      onNotice.ok(`Restore into ${into} started: the result appears in that server's Logs`);
    } catch (e) {
      onNotice.fail(e);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Create a backup">
        <div className="flex flex-wrap gap-2 p-4">
          <input className={field} placeholder="Label (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary btn-sm" onClick={() => act("backup.create", { name }, "Backup saved").then(() => setName(""))}>
            Back up the whole server
          </button>
        </div>
      </Panel>
      <Panel
        title={`Backups (${g.state.backups?.length ?? 0})`}
        actions={
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
            restore into
            <select className={field} value={restoreInto} onChange={(e) => setRestoreInto(e.target.value)}>
              {(guilds.data?.items ?? [{ id: g.id, name: g.name }]).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <Table head={["ID", "Name", "Created", "Size", ""]} empty={!g.state.backups?.length}>
          {g.state.backups?.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-2 font-mono text-xs text-amber">{b.id}</td>
              <td className="px-4 py-2">{b.name}</td>
              <td className="px-4 py-2 text-dim">{when(b.created_at)}</td>
              <td className="px-4 py-2 text-dim">{kb(b.size)}</td>
              <td className="space-x-2 px-4 py-2 text-right">
                <button className="btn-ghost btn-sm" onClick={() => restore(b.id)}>
                  Restore
                </button>
                <button className="btn-sm text-blood hover:text-white" onClick={() => confirm(`Delete backup ${b.id}?`) && act("backup.delete", { id: b.id }, "Backup deleted")}>
                  delete
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
