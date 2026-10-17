import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/forms";
import { GlitchText } from "@/components/fx/GlitchText";
import { Markdown } from "@/components/Markdown";
import { MediaGallery } from "@/components/MediaGallery";
import { apiGet } from "@/lib/backend";
import { CATEGORY_LABELS, SELL_TYPE_LABELS, date, money } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ canceled?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await apiGet<ProductDetail>(`/products/${slug}`);
  if (!p) return { title: "Product not found" };
  const img = p.media.find((m) => m.type === "image")?.url;
  return { title: p.name, description: p.tagline ?? undefined, openGraph: img ? { images: [img] } : undefined };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { canceled } = await searchParams;
  const p = await apiGet<ProductDetail>(`/products/${slug}`);
  if (!p) notFound();

  const custom = p.sell_type === "custom_build";
  const free = p.price_cents === 0;

  return (
    <div className="container-x pt-10">
      <nav className="mb-6 text-[11px] uppercase tracking-[0.2em] text-dim">
        <Link href="/store" className="hover:text-blood">
          store
        </Link>{" "}
        / <span className="text-muted">{CATEGORY_LABELS[p.category] ?? p.category}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <MediaGallery
            media={p.media}
            fallback={
              <div className="card corner-brackets grid aspect-video place-items-center bg-[radial-gradient(circle_at_center,rgba(230,0,0,.2),transparent_60%)]">
                <span className="font-display text-6xl font-black text-crimson/40">{p.name.slice(0, 2).toUpperCase()}</span>
              </div>
            }
          />
          {p.features.length > 0 && (
            <section className="mt-10">
              <h2 className="h-display mb-4 text-xl">Features</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.features.map((f) => (
                  <li key={f} className="card flex items-start gap-3 px-4 py-3 text-sm">
                    <span className="text-blood">▸</span>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="mt-10">
            <Markdown>{p.description}</Markdown>
          </section>
          {p.changelog && (
            <section className="mt-10">
              <h2 className="h-display mb-4 text-xl">Changelog</h2>
              <div className="card p-5">
                <Markdown>{p.changelog}</Markdown>
              </div>
            </section>
          )}
        </div>

        <aside>
          <div className="card corner-brackets space-y-5 p-6 shadow-neon lg:sticky lg:top-24">
            <div>
              <span className="tag border-crimson/50 text-blood">{CATEGORY_LABELS[p.category] ?? p.category}</span>
              <h1 className="h-display mt-3 text-2xl sm:text-3xl">
                <GlitchText text={p.name} />
              </h1>
              {p.tagline && <p className="mt-2 text-sm text-muted">{p.tagline}</p>}
            </div>
            <div className="font-display text-4xl font-black text-blood glow-text">{money(p.price_cents, p.currency)}</div>
            <dl className="space-y-2 text-sm">
              <Row label="Delivery" value={SELL_TYPE_LABELS[p.sell_type] ?? p.sell_type} />
              {p.version && <Row label="Version" value={`v${p.version}`} />}
              <Row label="Updated" value={date(p.updated_at)} />
            </dl>
            {canceled && (
              <div className="border border-amber/40 bg-amber/5 px-3 py-2 text-xs text-amber">Checkout canceled. No charge was made.</div>
            )}
            {custom ? (
              <Link href="/bots/commission" className="btn-primary w-full py-3.5">
                Request a quote
              </Link>
            ) : free ? (
              <Link href="/contact" className="btn-primary w-full py-3.5">
                Request access
              </Link>
            ) : (
              <BuyButton slug={p.slug} />
            )}
            {p.bot_slug && (
              <Link href={`/bots/${p.bot_slug}`} className="btn-ghost w-full">
                View live bot page →
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line pb-2">
      <dt className="text-[11px] uppercase tracking-[0.2em] text-dim">{label}</dt>
      <dd className="text-neutral-300">{value}</dd>
    </div>
  );
}
