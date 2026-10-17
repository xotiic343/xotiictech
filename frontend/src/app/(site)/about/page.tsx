import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { StatsBar } from "@/components/StatsBar";
import { PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { SiteData } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const site = await apiGet<SiteData>("/site");
  return (
    <>
      <PageHeader eyebrow="whoami" title={site?.about?.title ?? "About XotiicTech"} />
      <div className="container-x grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="card corner-brackets p-6 sm:p-10">
          <Markdown>{site?.about?.body ?? ""}</Markdown>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/bots/commission" className="btn-primary">
              Work with me
            </Link>
            <Link href="/portfolio" className="btn-ghost">
              See the work
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          {(site?.taglines ?? []).map((t) => (
            <div key={t} className="card px-5 py-4 font-display text-lg font-bold uppercase tracking-wide text-white">
              <span className="text-blood">&gt;</span> {t}
            </div>
          ))}
        </div>
      </div>
      {site && (
        <div className="container-x mt-12">
          <StatsBar
            stats={[
              { label: "Products sold", value: site.stats.products_sold ?? 0 },
              { label: "Bots deployed", value: site.stats.bots_deployed ?? 0 },
              { label: "Servers reached", value: site.stats.servers_reached ?? 0 },
              { label: "Clients", value: site.stats.clients ?? 0 },
            ]}
          />
        </div>
      )}
    </>
  );
}
