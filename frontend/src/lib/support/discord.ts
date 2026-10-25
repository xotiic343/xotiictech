// Server-side Discord REST helpers. They use the bot token, so 'server-only' stops them from ever
// being bundled into the browser.
import "server-only";
import { env } from "./env";

const API = "https://discord.com/api/v10";

export type DiscordMember = { roles: string[] };

async function discordFetch(path: string) {
  return fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${env().DISCORD_BOT_TOKEN}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
}

/** Fetch a guild member, or null if they are not in the guild. */
export async function getGuildMember(userId: string): Promise<DiscordMember | null> {
  const res = await discordFetch(`/guilds/${env().DISCORD_GUILD_ID}/members/${userId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Discord member lookup failed: ${res.status}`);
  return (await res.json()) as DiscordMember;
}

/** Approximate member count for the /support stats strip. */
export async function getGuildMemberCount(): Promise<number | null> {
  try {
    const res = await discordFetch(`/guilds/${env().DISCORD_GUILD_ID}?with_counts=true`);
    if (!res.ok) return null;
    const data = (await res.json()) as { approximate_member_count?: number };
    return data.approximate_member_count ?? null;
  } catch {
    return null;
  }
}

export type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username: string; global_name?: string | null; bot?: boolean };
  attachments: { id: string; filename: string; url: string }[];
};

/** Up to 100 recent messages from a ticket channel, oldest first. */
export async function getChannelMessages(channelId: string, limit = 100): Promise<DiscordMessage[]> {
  const res = await discordFetch(`/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`);
  if (!res.ok) throw new Error(`Discord message read failed: ${res.status}`);
  return ((await res.json()) as DiscordMessage[]).reverse();
}
