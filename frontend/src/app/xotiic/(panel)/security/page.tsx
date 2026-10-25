"use client";

import Link from "next/link";
import { Badge, PageTitle, Panel, Table, useAdmin } from "@/components/admin/kit";
import { timeAgo } from "@/lib/format";

type Row = {
  id: string; name: string; icon: string | null; members: number; online: boolean; updated_at: string;
  verified: number; raidmode: boolean; modules: Record<string, boolean>;
};
type Data = { configured: { bot_secret: boolean; bot_token: boolean; oauth: boolean }; items: Row[] };

// Security X control panel: every server the bot is in.
export default function SecurityXPage() {
  const { data, error, loading, reload } = useAdmin<Data>("/security/guilds");
  const missing = data
    ? [
        !data.configured.bot_secret && "SECURITY_BOT_SECRET",
        !data.configured.bot_token && "SECURITY_BOT_TOKEN",
        !data.configured.oauth && "SECURITY_CLIENT_ID / SECURITY_CLIENT_SECRET",
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <PageTitle title="Security X">
        <button className="btn-ghost btn-sm" onClick={reload}>
          Refresh
        </button>
      </PageTitle>
      {missing.length > 0 && (
        <div className="border border-amber/40 bg-amber/5 px-4 py-3 text-xs text-amber">Missing on the API service (Render): {missing.join(", ")}. See docs/SECURITY_X.md.</div>
      )}
      {error && <div className="text-sm text-blood">! {error}</div>}
      <Panel title="Servers">
        <Table head={["Server", "Bot", "Members", "Verified", "Protection", "Last report"]} empty={!loading && !data?.items.length}>
          {data?.items.map((g) => (
            <tr key={g.id} className="hover:bg-crimson/5">
              <td className="px-4 py-2.5">
                <Link href={`/xotiic/security/${g.id}`} className="flex items-center gap-3 hover:text-blood">
                  {g.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.icon} alt="" className="h-8 w-8 border border-edge" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center border border-edge text-[10px] text-blood">{g.name.slice(0, 2)}</span>
                  )}
                  <span className="text-white">{g.name}</span>
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={g.online ? "ok" : "bad"}>{g.online ? "online" : "offline"}</Badge>
              </td>
              <td className="px-4 py-2.5">{g.members.toLocaleString("en")}</td>
              <td className="px-4 py-2.5">{g.verified}</td>
              <td className="space-x-1 px-4 py-2.5">
                {g.raidmode && <Badge tone="bad">raid mode</Badge>}
                {["antinuke", "antiraid", "automod"].map((m) => (
                  <Badge key={m} tone={g.modules[m] ? "ok" : "muted"}>
                    {m}
                  </Badge>
                ))}
              </td>
              <td className="px-4 py-2.5 text-dim">{timeAgo(g.updated_at)}</td>
            </tr>
          ))}
        </Table>
        {!loading && !data?.items.length && (
          <p className="border-t border-line px-4 py-3 text-xs text-dim">
            No servers yet. Start the bot on Discloud with WEBSITE_URL and SECURITY_BOT_SECRET set; it reports within a minute.
          </p>
        )}
      </Panel>
    </div>
  );
}
