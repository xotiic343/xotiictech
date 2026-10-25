import Link from "next/link";
import { BotCard, ProductCard } from "@/components/cards";
import { FreeToolsBanner } from "@/components/FreeTools";
import { NewsletterForm } from "@/components/forms";
import { GlitchText } from "@/components/fx/GlitchText";
import { Reveal } from "@/components/fx/Reveal";
import { TypingTerminal } from "@/components/fx/TypingTerminal";
import { StatsBar } from "@/components/StatsBar";
import { Ticker } from "@/components/Ticker";
import { SectionHeading, Stars } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { BotCard as Bot, ProductCard as Product, SiteData } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [site, products, bots] = await Promise.all([
    apiGet<SiteData>("/site"),
    apiGet<{ items: Product[] }>("/products?featured=true"),
    apiGet<{ items: Bot[] }>("/bots?sort=featured"),
  ]);
  const hero = site?.hero;
  const featuredTool = site?.free_tools?.enabled ? (site.free_tools.items.find((t) => t.featured) ?? site.free_tools.items[0]) : undefined;
  const stats = site?.stats ?? {};

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="crt-flicker relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(230,0,0,.22),transparent_60%)]" />
        <div className="container-x relative grid min-h-[78vh] items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="eyebrow mb-5">{hero?.eyebrow ?? "// XOTIICTECH SYSTEMS ONLINE"}</div>
            <h1 className="h-display text-5xl leading-[0.95] sm:text-7xl xl:text-8xl">
              <GlitchText text={hero?.title ?? "XOTIICTECH"} className="glow-text" />
            </h1>
            <p className="mt-6 max-w-xl text-base text-neutral-400 sm:text-lg">{hero?.subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={hero?.primary_cta?.href ?? "/store"} className="btn-primary">
                {hero?.primary_cta?.label ?? "Enter the store"}
              </Link>
              <Link href={hero?.secondary_cta?.href ?? "/bots/commission"} className="btn-ghost">
                {hero?.secondary_cta?.label ?? "Commission a bot"}
              </Link>
            </div>
            {featuredTool && (
              <a
                href={featuredTool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber hover:text-white"
              >
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-amber" />
                Free: {featuredTool.name} →
              </a>
            )}
          </div>
          <div className="flex justify-center lg:justify-end">
            <TypingTerminal lines={hero?.terminal_lines ?? ["> booting xotiic.core ...", "> ready."]} />
          </div>
        </div>
      </section>

      {site && <Ticker ticker={site.ticker} />}

      {/* ---------- STATS ---------- */}
      <section className="container-x mt-16">
        <Reveal>
          <StatsBar
            stats={[
              { label: "Products sold", value: stats.products_sold ?? 0 },
              { label: "Bots deployed", value: stats.bots_deployed ?? 0 },
              { label: "Servers reached", value: stats.servers_reached ?? 0 },
              { label: "Clients", value: stats.clients ?? 0 },
            ]}
          />
        </Reveal>
      </section>

      {/* ---------- FREE TOOL ---------- */}
      {featuredTool && (
        <section className="container-x mt-16">
          <Reveal>
            <FreeToolsBanner tool={featuredTool} />
          </Reveal>
        </section>
      )}

      {/* ---------- PRODUCTS ---------- */}
      {!!products?.items.length && (
        <section className="container-x mt-24">
          <SectionHeading eyebrow="store" title="Featured drops" href="/store" />
          <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {products.items.slice(0, 6).map((p, i) => (
              <Reveal key={p.id} delay={i * 0.05} className="w-[85%] shrink-0 snap-start sm:w-auto">
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- BOTS ---------- */}
      {!!bots?.items.length && (
        <section className="container-x mt-24">
          <SectionHeading eyebrow="discord bots" title="Bots in the wild" href="/bots" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {bots.items.slice(0, 4).map((b, i) => (
              <Reveal key={b.id} delay={i * 0.05}>
                <BotCard bot={b} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- TESTIMONIALS ---------- */}
      {!!site?.testimonials.length && (
        <section className="container-x mt-24">
          <SectionHeading eyebrow="signal from clients" title="Testimonials" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {site.testimonials.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.05}>
                <figure className="card corner-brackets h-full p-6">
                  <Stars rating={t.rating} />
                  <blockquote className="mt-3 text-sm leading-relaxed text-neutral-300">“{t.quote}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                    {t.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.avatar_url} alt="" className="h-9 w-9 border border-edge object-cover" />
                    )}
                    <div>
                      <div className="font-display text-xs font-bold uppercase tracking-wider text-white">{t.name}</div>
                      {t.role && <div className="text-[11px] text-dim">{t.role}</div>}
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <section className="container-x mt-24">
        <Reveal>
          <div className="card corner-brackets grid items-center gap-6 p-8 shadow-neon md:grid-cols-2 md:p-10">
            <div>
              <div className="eyebrow mb-2">// transmission list</div>
              <h2 className="h-display text-2xl">Get drops before anyone else</h2>
              <p className="mt-2 text-sm text-muted">New bots, releases and discounts. No spam, unsubscribe anytime.</p>
            </div>
            <NewsletterForm />
          </div>
        </Reveal>
      </section>
    </>
  );
}
