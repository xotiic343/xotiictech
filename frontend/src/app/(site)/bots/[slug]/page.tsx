import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/cards";
import { ReviewForm } from "@/components/forms";
import { GlitchText } from "@/components/fx/GlitchText";
import { Markdown } from "@/components/Markdown";
import { MediaGallery } from "@/components/MediaGallery";
import { Stars, StatusDot } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import { compact, date, timeAgo } from "@/lib/format";
import type { BotDetail } from "@/lib/types";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bot = await apiGet<BotDetail>(`/bots/${slug}`);
  if (!bot) return { title: "Bot not found" };
  return { title: bot.name, description: bot.description, openGraph: { images: [bot.avatar_url] } };
}

const PRICING: Record<string, string> = { free: "Free", premium: "Premium", custom: "Custom" };
const CMD_TYPE: Record<number, string> = { 1: "/", 2: "user ›", 3: "msg ›" };

export default async function BotPage({ params }: Props) {
  const { slug } = await params;
  const bot = await apiGet<BotDetail>(`/bots/${slug}`);
  if (!bot) notFound();

  return (
    <article>
      {/* banner */}
      <div className="relative h-48 overflow-hidden border-b border-crimson/30 sm:h-64">
        {bot.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bot.banner_url} alt="" className="h-full w-full object-cover opacity-60" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(230,0,0,.35),transparent_70%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="container-x relative -mt-16 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bot.avatar_url} alt={bot.name} className="h-28 w-28 border-2 border-crimson bg-black shadow-neon-lg" />
            <div>
              <StatusDot status={bot.status} />
              <h1 className="h-display mt-1 text-3xl sm:text-5xl">
                <GlitchText text={bot.name} />
              </h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bot.tags.map((t) => (
                  <Link key={t} href={`/bots?tag=${encodeURIComponent(t)}`} className="tag hover:border-crimson">
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-base text-neutral-300">{bot.description}</p>

          {bot.media.length > 0 && (
            <section className="mt-10">
              <MediaGallery media={bot.media} />
            </section>
          )}

          {bot.long_description && (
            <section className="mt-10">
              <Markdown>{bot.long_description}</Markdown>
            </section>
          )}

          {/* commands */}
          <section className="mt-12">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="h-display text-xl">
                Commands <span className="text-blood">[{bot.commands.length}]</span>
              </h2>
              <span className="text-[11px] uppercase tracking-wider text-dim">synced {timeAgo(bot.last_synced_at)}</span>
            </div>
            {bot.commands.length ? (
              <div className="divide-y divide-line border border-line bg-ink/80">
                {bot.commands.map((c) => (
                  <details key={c.id} className="group px-4 py-3 open:bg-panel">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <code className="text-sm text-blood">
                        <span className="text-dim">{CMD_TYPE[c.type] ?? "/"}</span>
                        {c.name}
                      </code>
                      <span className="truncate text-sm text-muted">{c.description}</span>
                      {c.options.length > 0 && <span className="ml-auto text-xs text-dim group-open:rotate-90">▸</span>}
                    </summary>
                    {c.options.length > 0 && (
                      <ul className="mt-3 space-y-1 pl-4 text-xs">
                        {c.options.map((o) => (
                          <li key={o.name} className="text-muted">
                            <span className="text-amber">{o.name}</span>
                            {o.required && <span className="text-blood">*</span>} — {o.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No public slash commands registered.</p>
            )}
          </section>

          {bot.changelog && (
            <section className="mt-12">
              <h2 className="h-display mb-4 text-xl">Changelog {bot.version && <span className="text-blood">v{bot.version}</span>}</h2>
              <div className="card p-5">
                <Markdown>{bot.changelog}</Markdown>
              </div>
            </section>
          )}

          {/* reviews */}
          <section className="mt-12">
            <h2 className="h-display mb-4 text-xl">
              Reviews {bot.rating && <span className="ml-2 text-base"><Stars rating={bot.rating} /></span>}
            </h2>
            <div className="space-y-3">
              {bot.reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-white">{r.author}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="mt-2 text-sm text-neutral-300">{r.body}</p>
                  <div className="mt-2 text-[11px] text-dim">{date(r.created_at)}</div>
                </div>
              ))}
              {!bot.reviews.length && <p className="text-sm text-muted">No reviews yet.</p>}
              {bot.product && <ReviewForm slug={bot.slug} />}
            </div>
          </section>
        </div>

        {/* sidebar */}
        <aside className="space-y-5 lg:pt-20">
          <div className="card corner-brackets space-y-5 p-6 shadow-neon lg:sticky lg:top-24">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="border border-line py-3">
                <div className="font-display text-2xl font-black text-white glow-text">{compact(bot.guild_count)}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-dim">servers</div>
              </div>
              <div className="border border-line py-3">
                <div className="font-display text-2xl font-black text-white glow-text">{bot.command_count}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-dim">commands</div>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Pricing" value={bot.price_label || PRICING[bot.pricing_type]} accent />
              {bot.version && <Row label="Version" value={`v${bot.version}`} />}
              {bot.category && <Row label="Category" value={bot.category} />}
              <Row label="Last sync" value={timeAgo(bot.last_synced_at)} />
            </dl>
            <div className="space-y-2">
              {bot.invite_url && (
                <a href={bot.invite_url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
                  Invite to Discord
                </a>
              )}
              {bot.product && (
                <Link href={`/store/${bot.product.slug}`} className="btn-ghost w-full">
                  Buy in store
                </Link>
              )}
              {bot.support_url && (
                <a href={bot.support_url} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                  Support server
                </a>
              )}
              {bot.website_url && (
                <a href={bot.website_url} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                  Website
                </a>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="eyebrow mb-2">// want one like this?</div>
            <p className="text-sm text-muted">I build custom bots with the features your server actually needs.</p>
            <Link href={`/bots/commission?ref=${bot.slug}`} className="btn-ghost btn-sm mt-4 w-full">
              Commission similar
            </Link>
          </div>

          {bot.product && <ProductCard product={bot.product} />}
        </aside>
      </div>
    </article>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between border-b border-line pb-2">
      <dt className="text-[11px] uppercase tracking-[0.2em] text-dim">{label}</dt>
      <dd className={accent ? "font-bold text-blood" : "text-neutral-300"}>{value}</dd>
    </div>
  );
}
