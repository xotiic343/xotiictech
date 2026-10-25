"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { BotCard, ProductCard } from "@/components/cards";
import { EmptyState } from "@/components/ui";
import type { BotCard as Bot, ProductCard as Product } from "@/lib/types";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition ${
        active ? "border-crimson bg-crimson/15 text-blood shadow-neon" : "border-edge text-muted hover:border-crimson/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">{children}</AnimatePresence>
    </motion.div>
  );
}

function Cell({ id, children }: { id: string | number; children: React.ReactNode }) {
  return (
    <motion.div key={id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
      {children}
    </motion.div>
  );
}

export function BotsExplorer({ bots, tags }: { bots: Bot[]; tags: string[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<"featured" | "servers" | "name" | "newest">("featured");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tag");
    if (t && tags.includes(t)) setTag(t);
  }, [tags]);

  const items = useMemo(() => {
    const list = tag ? bots.filter((b) => b.tags.includes(tag)) : [...bots];
    const ts = (b: Bot) => new Date(b.published_at ?? b.first_seen_at).getTime();
    switch (sort) {
      case "servers":
        return list.sort((a, b) => b.guild_count - a.guild_count);
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "newest":
        return list.sort((a, b) => ts(b) - ts(a));
      default:
        return list;
    }
  }, [bots, tag, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Chip active={!tag} onClick={() => setTag(null)}>
            All
          </Chip>
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
              {t}
            </Chip>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input w-auto" aria-label="Sort bots">
          <option value="featured">Featured</option>
          <option value="servers">Most servers</option>
          <option value="name">Name</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      {items.length ? (
        <Grid>
          {items.map((b) => (
            <Cell key={b.id} id={b.id}>
              <BotCard bot={b} />
            </Cell>
          ))}
        </Grid>
      ) : (
        <EmptyState title="No bots match">Try another tag.</EmptyState>
      )}
    </div>
  );
}

export function StoreExplorer({
  products,
  categories,
}: {
  products: Product[];
  categories: { value: string; label: string }[];
}) {
  const [category, setCategory] = useState<string | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c && categories.some((x) => x.value === c)) setCategory(c);
  }, [categories]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"featured" | "newest" | "price_asc" | "price_desc">("featured");

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!needle || p.name.toLowerCase().includes(needle) || (p.tagline ?? "").toLowerCase().includes(needle)),
    );
    switch (sort) {
      case "newest":
        return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      case "price_asc":
        return list.sort((a, b) => a.price_cents - b.price_cents);
      case "price_desc":
        return list.sort((a, b) => b.price_cents - a.price_cents);
      default:
        return list;
    }
  }, [products, category, q, sort]);

  return (
    <div>
      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="> search the store…" className="input" aria-label="Search" />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input md:w-48" aria-label="Sort products">
          <option value="featured">Featured</option>
          <option value="newest">Recently updated</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
        </select>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        <Chip active={!category} onClick={() => setCategory(null)}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {items.length ? (
        <Grid>
          {items.map((p) => (
            <Cell key={p.id} id={p.id}>
              <ProductCard product={p} />
            </Cell>
          ))}
        </Grid>
      ) : (
        <EmptyState title="Nothing here yet">No products match those filters.</EmptyState>
      )}
    </div>
  );
}
