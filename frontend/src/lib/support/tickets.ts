// Ticket helpers shared by /support pages and route handlers.
import "server-only";
import { prisma } from "./db";
import { getChannelMessages } from "./discord";

export const STATES = ["open", "claimed", "pending", "closed"] as const;

export const STATE_LABEL: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  pending: "Pending",
  closed: "Closed",
};

/** Zero-padded like the bot: #0001. */
export function ticketLabel(number: number) {
  return `#${String(number).padStart(4, "0")}`;
}

export function discordChannelUrl(guildId: string, channelId: string | null) {
  return channelId ? `https://discord.com/channels/${guildId}/${channelId}` : null;
}

/**
 * If we have no stored messages for a ticket (e.g. opened before the bot synced), backfill the last
 * 100 from the Discord channel. Idempotent: discordMessageId is unique.
 */
export async function ensureTranscript(ticket: { id: string; channelId: string | null }) {
  if (!ticket.channelId) return;
  if ((await prisma.ticketMessage.count({ where: { ticketId: ticket.id } })) > 0) return;
  try {
    const messages = await getChannelMessages(ticket.channelId, 100);
    if (messages.length === 0) return;
    await prisma.ticketMessage.createMany({
      data: messages.map((m) => ({
        ticketId: ticket.id,
        discordMessageId: m.id,
        authorId: m.author.id,
        authorName: m.author.global_name || m.author.username,
        isStaff: false,
        source: m.author.bot ? "system" : "discord",
        content: m.content || "",
        attachments: m.attachments.length ? m.attachments.map((a) => ({ name: a.filename, url: a.url })) : undefined,
        createdAt: new Date(m.timestamp),
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[support] transcript backfill failed", ticket.id, err);
  }
}

/** "42m", "3h 10m", "2d 4h". */
export function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mins % 60 ? `${hours}h ${mins % 60}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d)) : "—";
