import type { Metadata } from "next";
import { StoreExplorer } from "@/components/explorers";
import { PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { ProductCard } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Store",
  description: "Source code, Discord bots, Minecraft clients and PC applications, delivered instantly.",
};

export default async function StorePage() {
  const data = await apiGet<{ items: ProductCard[]; categories: { value: string; label: string }[] }>("/products");
  return (
    <>
      <PageHeader eyebrow="store" title="The armory" subtitle="Source code, Discord bots, Minecraft clients and PC apps. Pay once, download instantly." />
      <div className="container-x">
        <StoreExplorer products={data?.items ?? []} categories={data?.categories ?? []} />
      </div>
    </>
  );
}
