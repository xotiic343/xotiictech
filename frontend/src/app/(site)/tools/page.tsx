import type { Metadata } from "next";
import { FreeToolCard, FreeToolsBanner } from "@/components/FreeTools";
import { EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { SiteData } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Free Tools",
  description: "Free tools from XotiicTech, including the R6XScan Rainbow Six Siege PC checker.",
};

export default async function ToolsPage() {
  const site = await apiGet<SiteData>("/site");
  const tools = site?.free_tools?.enabled ? site.free_tools.items : [];
  const [featured, ...rest] = [...tools].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));

  return (
    <>
      <PageHeader
        eyebrow="no paywall"
        title={site?.free_tools?.headline || "Free tools"}
        subtitle="Free utilities for gamers and server owners. No account needed."
      />
      <div className="container-x space-y-8">
        {featured ? <FreeToolsBanner tool={featured} /> : <EmptyState title="No tools yet" />}
        {rest.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((t) => (
              <FreeToolCard key={t.url} tool={t} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
