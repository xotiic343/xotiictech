export function money(cents: number, currency = "usd"): string {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function compact(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  if (typeof n === "string") return n;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  source_code: "Source Code",
  discord_bots: "Discord Bots",
  minecraft_clients: "Minecraft Clients",
  pc_applications: "PC Applications",
};

export const SELL_TYPE_LABELS: Record<string, string> = {
  download: "Instant download",
  source_code: "Source code",
  license: "License",
  hosted: "Hosted instance",
  custom_build: "Custom build",
};
