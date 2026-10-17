import type { Metadata } from "next";
import Link from "next/link";
import { BotsExplorer } from "@/components/explorers";
import { StatsBar } from "@/components/StatsBar";
import { EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { BotCard } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Discord Bots",
  description: "Custom Discord bots, built to your spec. Live server counts and command lists.",
};

type Stats = { total_bots: number; bots_online: number; total_servers: number; total_commands: number };

export default async function BotsPage() {
  const [data, stats] = await Promise.all([
    apiGet<{ items: BotCard[]; tags: string[] }>("/bots"),
    apiGet<Stats>("/bots/stats"),
  ]);
  const featured = data?.items.find((b) => b.is_featured);

  return (
    <>
      <PageHeader eyebrow="discord bots" title="Custom Discord bots, built to your spec." subtitle="Every bot below is synced live from Discord: real server counts and real command lists, updated automatically.">
        <div className="flex flex-wrap gap-3">
          <Link href="/bots/commission" className="btn-primary">
            Commission a custom bot
          </Link>
          <Link href="/store?category=discord_bots" className="btn-ghost">
            Buy pre-built bots
          </Link>
        </div>
      </PageHeader>

      <div className="container-x space-y-12">
        <StatsBar
          stats={[
            { label: "Bots", value: stats?.total_bots ?? 0 },
            { label: "Online now", value: stats?.bots_online ?? 0 },
            { label: "Servers reached", value: stats?.total_servers ?? 0 },
            { label: "Total commands", value: stats?.total_commands ?? 0 },
          ]}
        />

        {featured && (
          <Link
            href={`/bots/${featured.slug}`}
            className="card card-hover corner-brackets group relative block overflow-hidden p-6 shadow-neon sm:p-8"
          >
            {featured.banner_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
            )}
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featured.avatar_url} alt="" className="h-24 w-24 border-2 border-crimson shadow-neon" />
              <div className="flex-1">
                <div className="eyebrow mb-1">// featured bot</div>
                <div className="aberrate-child font-display text-3xl font-black uppercase text-white">{featured.name}</div>
                <p className="mt-2 max-w-2xl text-sm text-neutral-400">{featured.description}</p>
              </div>
              <span className="btn-primary shrink-0">View bot →</span>
            </div>
          </Link>
        )}

        {data?.items.length ? (
          <BotsExplorer bots={data.items} tags={data.tags} />
        ) : (
          <EmptyState title="Bots incoming">The bot fleet is syncing. Check back shortly.</EmptyState>
        )}
      </div>
    </>
  );
}
