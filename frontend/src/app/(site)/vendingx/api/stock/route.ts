import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.VENDINGX_BOT_TOKEN || "";
const BETA_CHANNEL = process.env.VENDINGX_BETA_CHANNEL_ID || "";
const PREMIUM_CHANNEL = process.env.VENDINGX_PREMIUM_CHANNEL_ID || "";
const DISCORD_API = "https://discord.com/api/v10";

interface StockItem {
  name: string;
  description: string;
  count: number;
  premium: boolean;
}

let cache: { data: Record<string, StockItem>; ts: number } | null = null;
const CACHE_TTL = 60_000;

async function readChannelEmbed(channelId: string): Promise<string | null> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=5`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
  if (!res.ok) return null;

  const messages = await res.json();
  for (const msg of messages) {
    if (msg.embeds?.length) {
      for (const embed of msg.embeds) {
        if (embed.fields?.length) {
          return embed.fields.map((f: { value: string }) => f.value).join("\n");
        }
      }
    }
  }
  return null;
}

function parseStockLines(text: string, premium: boolean): Record<string, StockItem> {
  const result: Record<string, StockItem> = {};
  const re = /\*\*(.+?)\*\*\s*[—–-]\s*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim();
    const count = parseInt(m[2], 10);
    const key = premium
      ? `premium_${name.toLowerCase().replace(/\s+/g, "_")}`
      : name.toLowerCase().replace(/\s+/g, "_");
    result[key] = { name, description: premium ? `Premium ${name}` : name, count, premium };
  }
  return result;
}

export async function GET() {
  if (!BOT_TOKEN) {
    return NextResponse.json({});
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const stock: Record<string, StockItem> = {};

  try {
    const [betaText, premText] = await Promise.all([
      BETA_CHANNEL ? readChannelEmbed(BETA_CHANNEL) : null,
      PREMIUM_CHANNEL ? readChannelEmbed(PREMIUM_CHANNEL) : null,
    ]);
    if (betaText) Object.assign(stock, parseStockLines(betaText, false));
    if (premText) Object.assign(stock, parseStockLines(premText, true));
  } catch { /* return empty stock on error */ }

  cache = { data: stock, ts: Date.now() };
  return NextResponse.json(stock);
}
