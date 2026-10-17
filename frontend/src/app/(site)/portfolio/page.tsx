import type { Metadata } from "next";
import { PortfolioExplorer } from "@/components/explorers";
import { PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { Project } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Portfolio", description: "Selected projects by XotiicTech." };

export default async function PortfolioPage() {
  const data = await apiGet<{ items: Project[]; categories: string[] }>("/portfolio");
  return (
    <>
      <PageHeader eyebrow="portfolio" title="Selected work" subtitle="Bots, clients, tools and sites, shipped and running in production." />
      <div className="container-x">
        <PortfolioExplorer projects={data?.items ?? []} categories={data?.categories ?? []} />
      </div>
    </>
  );
}
