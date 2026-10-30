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
        {/* Vending X featured products */}
        <div className="mb-10">
          <h2 className="mb-4 font-display text-sm font-bold tracking-[0.15em] text-blood">VENDING X</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/vendingx/checkout/premium"
              className="group relative overflow-hidden border border-blood/30 bg-blood/5 p-6 transition hover:border-blood/60 hover:bg-blood/10"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-xs font-bold tracking-wider text-blood">PREMIUM ACCESS</span>
                <span className="font-display text-lg font-bold text-white">$3</span>
              </div>
              <p className="text-sm text-muted">
                Unlock all premium stock items in the Vending X bot. One-time payment, instant access.
              </p>
              <span className="mt-4 inline-block font-display text-[10px] tracking-wider text-blood/60 transition group-hover:text-blood">
                BUY NOW &rarr;
              </span>
            </a>
            <a
              href="/vendingx/checkout/bot-access"
              className="group relative overflow-hidden border border-line/60 bg-black/40 p-6 transition hover:border-crimson/40 hover:bg-blood/5"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-xs font-bold tracking-wider text-neutral-300">BOT ACCESS</span>
                <span className="font-display text-lg font-bold text-white">$50</span>
              </div>
              <p className="text-sm text-muted">
                Full access to the Vending X bot for your own Discord server. Includes all features and updates.
              </p>
              <span className="mt-4 inline-block font-display text-[10px] tracking-wider text-muted transition group-hover:text-blood">
                BUY NOW &rarr;
              </span>
            </a>
          </div>
        </div>
        <StoreExplorer products={data?.items ?? []} categories={data?.categories ?? []} />
      </div>
    </>
  );
}
