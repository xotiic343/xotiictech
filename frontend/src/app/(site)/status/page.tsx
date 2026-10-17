import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatusDot } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import { timeAgo } from "@/lib/format";

export const revalidate = 30;
export const metadata: Metadata = { title: "Status" };

type Status = {
  api: string;
  store: string;
  bots: { slug: string; name: string; status: string; avatar_url: string; last_synced_at: string | null }[];
  last_sync: { status: string; finished_at: string | null } | null;
};

export default async function StatusPage() {
  const s = await apiGet<Status>("/status", 30);
  const allOk = s && s.api === "operational" && s.bots.every((b) => b.status === "online");
  return (
    <>
      <PageHeader eyebrow="telemetry" title="System status" />
      <div className="container-x max-w-4xl space-y-6">
        <div className={`card corner-brackets flex items-center gap-4 p-6 ${allOk ? "shadow-[0_0_24px_rgba(34,255,136,.15)]" : "shadow-neon"}`}>
          <span className={`h-4 w-4 rounded-full ${s ? (allOk ? "animate-pulse-dot bg-ok" : "bg-amber") : "bg-blood"}`} />
          <div className="font-display text-lg font-bold uppercase tracking-wide text-white">
            {!s ? "API unreachable" : allOk ? "All systems operational" : "Partial degradation"}
          </div>
        </div>
        {s && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Service name="API" status={s.api} />
              <Service name="Store / checkout" status={s.store} />
            </div>
            <div className="card divide-y divide-line">
              <div className="flex items-center justify-between px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-dim">
                <span>Discord bots</span>
                <span>last sync {timeAgo(s.last_sync?.finished_at)}</span>
              </div>
              {s.bots.map((b) => (
                <Link key={b.slug} href={`/bots/${b.slug}`} className="flex items-center gap-3 px-5 py-3 hover:bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.avatar_url} alt="" className="h-7 w-7 border border-edge" />
                  <span className="flex-1 text-sm text-white">{b.name}</span>
                  <StatusDot status={b.status} />
                </Link>
              ))}
              {!s.bots.length && <div className="px-5 py-4 text-sm text-muted">No bots published.</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Service({ name, status }: { name: string; status: string }) {
  const ok = status === "operational";
  return (
    <div className="card flex items-center justify-between p-5">
      <span className="text-sm uppercase tracking-wider text-white">{name}</span>
      <span className={`text-xs uppercase tracking-wider ${ok ? "text-ok" : "text-amber"}`}>{status}</span>
    </div>
  );
}
