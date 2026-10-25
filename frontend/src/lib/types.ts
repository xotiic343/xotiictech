export type Media = { type: "image" | "video"; url: string; alt?: string };

export type BotCard = {
  id: number;
  slug: string;
  name: string;
  description: string;
  avatar_url: string;
  banner_url: string | null;
  tags: string[];
  category: string | null;
  guild_count: number;
  command_count: number;
  status: "online" | "offline";
  is_featured: boolean;
  pricing_type: "free" | "premium" | "custom";
  price_label: string | null;
  published_at: string | null;
  first_seen_at: string;
};

export type BotCommand = {
  id: number;
  name: string;
  description: string | null;
  type: number;
  options: { name: string; description?: string; type: number; required?: boolean }[];
  guild_scoped: boolean;
};

export type Review = { id: number; author: string; rating: number; body: string; created_at: string };

export type LiveStat = { key: string; label: string; value: number; format: "number" | "duration_ms" | "rating" | "percent" };

export type BotDetail = BotCard & {
  live_stats: LiveStat[];
  live_stats_at: string | null;
  long_description: string;
  media: Media[];
  support_url: string | null;
  website_url: string | null;
  invite_url: string | null;
  version: string | null;
  changelog: string | null;
  last_synced_at: string | null;
  commands: BotCommand[];
  product: ProductCard | null;
  reviews: Review[];
  rating: number | null;
};

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  category: string;
  sell_type: string;
  price_cents: number;
  currency: string;
  media: Media[];
  version: string | null;
  is_featured: boolean;
  is_bot: boolean;
  bot_slug: string | null;
  updated_at: string;
};

export type ProductDetail = ProductCard & {
  description: string;
  features: string[];
  changelog: string | null;
  has_download: boolean;
  sales_count: number;
  created_at: string;
};

export type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  kind: "announcement" | "tutorial" | "changelog";
  tags: string[];
  cover_image: string | null;
  published_at: string | null;
};

export type Doc = { id: number; slug: string; title: string; section: string; body?: string };

export type Testimonial = { id: number; name: string; role: string | null; quote: string; avatar_url: string | null; rating: number };

export type FreeTool = { name: string; description?: string; url: string; badge?: string; featured?: boolean };

export type SiteData = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    terminal_lines: string[];
    primary_cta: { label: string; href: string };
    secondary_cta: { label: string; href: string };
  };
  ticker: { enabled: boolean; items: string[]; live: string[] };
  stats: Record<string, number | string | null>;
  about: { title: string; body: string };
  taglines: string[];
  socials: Record<string, string>;
  footer: { blurb: string; support_email: string };
  free_tools: { enabled: boolean; headline: string; items: FreeTool[] };
  testimonials: Testimonial[];
};
