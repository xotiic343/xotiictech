import Link from "next/link";
import { StatusDot } from "@/components/ui";
import { CATEGORY_LABELS, compact, money } from "@/lib/format";
import type { BotCard as Bot, ProductCard as Product, Project } from "@/lib/types";

export function BotCard({ bot }: { bot: Bot }) {
  return (
    <Link href={`/bots/${bot.slug}`} className="card card-hover group flex h-full flex-col p-5">
      {bot.is_featured && (
        <span className="absolute right-3 top-3 border border-amber/60 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-amber">
          Featured
        </span>
      )}
      <div className="flex items-center gap-4">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bot.avatar_url}
            alt=""
            className="h-14 w-14 border border-edge object-cover transition group-hover:border-crimson"
            loading="lazy"
          />
          <span
            className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-ink ${
              bot.status === "online" ? "bg-ok" : "bg-dim"
            }`}
          />
        </div>
        <div className="min-w-0">
          <div className="aberrate-child truncate font-display text-base font-bold uppercase tracking-wide text-white">{bot.name}</div>
          <StatusDot status={bot.status} />
        </div>
      </div>
      <p className="mt-4 line-clamp-3 flex-1 text-sm text-muted">{bot.description || "No description yet."}</p>
      {bot.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {bot.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-5 grid grid-cols-3 border-t border-line pt-3 text-center text-[11px] uppercase tracking-wider">
        <div>
          <div className="font-display text-sm text-white">{compact(bot.guild_count)}</div>
          <div className="text-dim">servers</div>
        </div>
        <div>
          <div className="font-display text-sm text-white">{bot.command_count}</div>
          <div className="text-dim">commands</div>
        </div>
        <div>
          <div className="font-display text-sm text-blood">{bot.price_label || bot.pricing_type}</div>
          <div className="text-dim">pricing</div>
        </div>
      </div>
    </Link>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const cover = product.media[0];
  return (
    <Link href={`/store/${product.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-video overflow-hidden border-b border-line bg-panel">
        {cover?.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.alt ?? ""}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:saturate-150"
            loading="lazy"
          />
        ) : cover?.type === "video" ? (
          <video src={cover.url} muted loop playsInline autoPlay className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center font-display text-4xl font-black text-crimson/40">
            {product.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
        <span className="tag absolute left-3 top-3 border-crimson/50 text-blood">{CATEGORY_LABELS[product.category] ?? product.category}</span>
        {product.is_featured && (
          <span className="absolute right-3 top-3 border border-amber/60 bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-amber">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="aberrate-child font-display text-base font-bold uppercase tracking-wide text-white">{product.name}</div>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{product.tagline}</p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="font-display text-lg font-bold text-blood glow-text">{money(product.price_cents, product.currency)}</span>
          <span className="text-[11px] uppercase tracking-wider text-dim">{product.version ? `v${product.version}` : ""}</span>
        </div>
      </div>
    </Link>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const cover = project.cover_image || project.media.find((m) => m.type === "image")?.url;
  return (
    <Link href={`/portfolio/${project.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-panel">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_30%,rgba(230,0,0,.25),transparent_60%)] font-display text-3xl font-black text-white/20">
            {project.title.slice(0, 3).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black via-black/30 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
          <span className="text-xs uppercase tracking-[0.2em] text-blood">Open project →</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {project.category && <div className="eyebrow mb-1">{project.category}</div>}
        <div className="aberrate-child font-display text-base font-bold uppercase tracking-wide text-white">{project.title}</div>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{project.summary}</p>
        {project.stack.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.stack.slice(0, 5).map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
