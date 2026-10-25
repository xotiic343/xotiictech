"use client";

// Invite URL generator, like Discord's OAuth2 URL Generator: pick a bot (or paste an application ID),
// scopes and permissions, and get a shareable invite link. Runs entirely in the browser.
import { useMemo, useState } from "react";
import { PageTitle, Panel, useAdmin, useNotice } from "@/components/admin/kit";

type AdminBot = { id: number; name: string; application_id: string | null; discord_id: string };

const b = (n: number) => 1n << BigInt(n);

const PERMISSIONS: { group: string; items: [string, bigint][] }[] = [
  {
    group: "General",
    items: [
      ["Administrator", b(3)], ["View Audit Log", b(7)], ["View Server Insights", b(19)], ["Manage Server", b(5)],
      ["Manage Roles", b(28)], ["Manage Channels", b(4)], ["Kick Members", b(1)], ["Ban Members", b(2)],
      ["Create Instant Invite", b(0)], ["Change Nickname", b(26)], ["Manage Nicknames", b(27)],
      ["Manage Expressions", b(30)], ["Create Expressions", b(43)], ["Manage Webhooks", b(29)],
      ["View Channels", b(10)], ["Manage Events", b(33)], ["Create Events", b(44)], ["Moderate Members", b(40)],
    ],
  },
  {
    group: "Text",
    items: [
      ["Send Messages", b(11)], ["Create Public Threads", b(35)], ["Create Private Threads", b(36)],
      ["Send Messages in Threads", b(38)], ["Send TTS Messages", b(12)], ["Manage Messages", b(13)],
      ["Manage Threads", b(34)], ["Embed Links", b(14)], ["Attach Files", b(15)], ["Read Message History", b(16)],
      ["Mention Everyone", b(17)], ["Use External Emojis", b(18)], ["Use External Stickers", b(37)],
      ["Add Reactions", b(6)], ["Use Slash Commands", b(31)], ["Use Embedded Activities", b(39)],
      ["Send Voice Messages", b(46)], ["Create Polls", b(49)], ["Use External Apps", b(50)],
    ],
  },
  {
    group: "Voice",
    items: [
      ["Connect", b(20)], ["Speak", b(21)], ["Video", b(9)], ["Mute Members", b(22)], ["Deafen Members", b(23)],
      ["Move Members", b(24)], ["Use Voice Activity", b(25)], ["Priority Speaker", b(8)], ["Request to Speak", b(32)],
      ["Use Soundboard", b(42)], ["Use External Sounds", b(45)], ["Set Voice Channel Status", b(48)],
    ],
  },
];

const SCOPES: [string, string][] = [
  ["bot", "Adds the bot to a server"],
  ["applications.commands", "Slash commands in that server"],
  ["identify", "User login: username and avatar"],
  ["email", "User login: email address"],
  ["guilds", "User login: list of their servers"],
  ["guilds.join", "Lets the app add the user to servers"],
  ["guilds.members.read", "User's member info in servers"],
  ["connections", "User's linked accounts"],
  ["role_connections.write", "Linked roles metadata"],
  ["applications.commands.permissions.update", "Update command permissions"],
  ["webhook.incoming", "Create a webhook in a channel"],
];
// Scopes that only add the bot don't need a redirect; anything else is a user login (code grant).
const BOT_ONLY = new Set(["bot", "applications.commands", "applications.commands.permissions.update"]);

const name = (p: bigint) => PERMISSIONS.flatMap((g) => g.items).find(([, v]) => v === p)?.[0];
const PRESETS: { label: string; scopes: string[]; perms: string[] }[] = [
  { label: "Administrator", scopes: ["bot", "applications.commands"], perms: ["Administrator"] },
  {
    label: "Ticket X",
    scopes: ["bot", "applications.commands"],
    perms: ["Manage Channels", "Manage Roles", "View Channels", "Send Messages", "Embed Links", "Attach Files", "Read Message History", "Manage Messages"],
  },
  {
    label: "Moderation",
    scopes: ["bot", "applications.commands"],
    perms: ["View Audit Log", "Kick Members", "Ban Members", "Moderate Members", "Manage Messages", "Manage Roles", "Manage Channels", "View Channels", "Send Messages", "Embed Links", "Read Message History", "Move Members"],
  },
  { label: "Basic", scopes: ["bot", "applications.commands"], perms: ["View Channels", "Send Messages", "Embed Links", "Attach Files", "Read Message History", "Add Reactions", "Use External Emojis"] },
];

export default function InviteGeneratorPage() {
  const { data: bots } = useAdmin<{ items: AdminBot[] }>("/bots");
  const { notice, ok, fail } = useNotice();
  const [clientId, setClientId] = useState("");
  const [scopes, setScopes] = useState<string[]>(["bot", "applications.commands"]);
  const [perms, setPerms] = useState<bigint>(b(3));
  const [integration, setIntegration] = useState<"0" | "1">("0");
  const [guildId, setGuildId] = useState("");
  const [lockGuild, setLockGuild] = useState(false);
  const [redirect, setRedirect] = useState("");

  const needsRedirect = scopes.some((s) => !BOT_ONLY.has(s));
  const hasBot = scopes.includes("bot");
  const validId = /^\d{15,25}$/.test(clientId);

  const url = useMemo(() => {
    if (!validId || !scopes.length) return "";
    const p = new URLSearchParams({ client_id: clientId });
    if (hasBot) p.set("permissions", perms.toString());
    if (hasBot || scopes.includes("applications.commands")) p.set("integration_type", integration);
    if (guildId && /^\d{15,25}$/.test(guildId)) {
      p.set("guild_id", guildId);
      if (lockGuild) p.set("disable_guild_select", "true");
    }
    if (needsRedirect) {
      p.set("response_type", "code");
      if (redirect) p.set("redirect_uri", redirect);
    }
    p.set("scope", scopes.join(" "));
    return `https://discord.com/oauth2/authorize?${p.toString().replace(/\+/g, "%20")}`;
  }, [clientId, validId, scopes, perms, integration, guildId, lockGuild, needsRedirect, redirect, hasBot]);

  const toggleScope = (s: string) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const togglePerm = (v: bigint) => setPerms((cur) => cur ^ v);
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setScopes(p.scopes);
    setPerms(p.perms.reduce((acc, n) => acc | (PERMISSIONS.flatMap((g) => g.items).find(([k]) => k === n)?.[1] ?? 0n), 0n));
  };
  const selectedNames = PERMISSIONS.flatMap((g) => g.items).filter(([, v]) => (perms & v) === v).map(([k]) => k);

  return (
    <div className="space-y-6">
      {notice}
      <PageTitle title="Invite URL generator" />

      <Panel title="1. Application">
        <div className="flex flex-wrap gap-2 p-4">
          <select className="input py-1.5 text-xs sm:w-60" value="" onChange={(e) => e.target.value && setClientId(e.target.value)}>
            <option value="">pick one of your bots…</option>
            {bots?.items.map((bot) => (
              <option key={bot.id} value={bot.application_id || bot.discord_id}>
                {bot.name}
              </option>
            ))}
          </select>
          <input className="input flex-1 py-1.5 text-xs" placeholder="…or paste an Application (client) ID" value={clientId} onChange={(e) => setClientId(e.target.value.trim())} />
        </div>
      </Panel>

      <Panel title="2. Scopes">
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCOPES.map(([s, desc]) => (
            <label key={s} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-[#e60000]" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
              <span>
                <span className="font-mono text-xs text-white">{s}</span>
                <span className="block text-[11px] text-dim">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {needsRedirect && (
          <div className="border-t border-line p-4">
            <label className="label">Redirect URL (needed for login scopes; must be added under OAuth2 → Redirects)</label>
            <input className="input py-1.5 text-xs" placeholder="https://xotiictech.net/api/security/oauth/callback" value={redirect} onChange={(e) => setRedirect(e.target.value.trim())} />
          </div>
        )}
      </Panel>

      {hasBot && (
        <Panel
          title={`3. Bot permissions (${perms.toString()})`}
          actions={
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button key={p.label} className="btn-ghost btn-sm" onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
              <button className="btn-sm text-blood hover:text-white" onClick={() => setPerms(0n)}>
                clear
              </button>
            </div>
          }
        >
          <div className="grid gap-6 p-4 lg:grid-cols-3">
            {PERMISSIONS.map((g) => (
              <div key={g.group}>
                <div className="eyebrow mb-2">// {g.group}</div>
                <div className="space-y-1.5">
                  {g.items.map(([label, v]) => (
                    <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-[#e60000]" checked={(perms & v) === v} onChange={() => togglePerm(v)} />
                      <span className={label === "Administrator" ? "text-amber" : "text-neutral-300"}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {(perms & b(3)) === b(3) && selectedNames.length > 1 && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-dim">Administrator already includes every other permission.</p>
          )}
        </Panel>
      )}

      <Panel title="4. Options">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <label className="text-xs">
            <span className="label">Install as</span>
            <select className="input py-1.5 text-xs" value={integration} onChange={(e) => setIntegration(e.target.value as "0" | "1")}>
              <option value="0">Server (guild install)</option>
              <option value="1">User install</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="label">Pre-select server ID (optional)</span>
            <input className="input py-1.5 text-xs" value={guildId} onChange={(e) => setGuildId(e.target.value.trim())} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" className="accent-[#e60000]" checked={lockGuild} disabled={!guildId} onChange={(e) => setLockGuild(e.target.checked)} />
            Don&apos;t let them pick another server
          </label>
        </div>
      </Panel>

      <Panel title="Generated URL">
        <div className="space-y-3 p-4">
          {url ? (
            <>
              <code className="block break-all border border-crimson/40 bg-black p-3 text-xs text-amber">{url}</code>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => navigator.clipboard.writeText(url).then(() => ok("Invite link copied")).catch(fail)}
                >
                  Copy
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                  Open
                </a>
              </div>
              {needsRedirect && !redirect && <p className="text-[11px] text-amber">Login scopes are selected: add a redirect URL above, or Discord will reject the link.</p>}
            </>
          ) : (
            <p className="text-sm text-dim">{validId ? "Pick at least one scope." : "Pick a bot or paste its Application ID."}</p>
          )}
        </div>
      </Panel>
      <span className="hidden">{name(0n)}</span>
    </div>
  );
}
