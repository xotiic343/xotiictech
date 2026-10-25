// GET  /support/api/tickets: the logged-in user's own tickets.
// POST /support/api/tickets: open a ticket. The bot creates the Discord channel; we store the mirror row.
import { prisma } from "@/lib/support/db";
import { getCurrentUser } from "@/lib/support/session";
import { rateLimit } from "@/lib/support/ratelimit";
import { createTicketSchema } from "@/lib/support/validators";
import { apiError, apiOk, assertSameOrigin, readJson } from "@/lib/support/api";
import { BotUnavailableError, createTicketInBot, type BotCreatedTicket } from "@/lib/support/botApi";
import { audit } from "@/lib/support/audit";
import { discordChannelUrl } from "@/lib/support/tickets";

const MAX_OPEN_PER_USER = 5;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized", "Log in with Discord first.");
  const tickets = await prisma.ticket.findMany({
    where: { openerId: user.discordId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, number: true, category: true, subject: true, state: true, createdAt: true },
  });
  return apiOk(tickets);
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized", "Log in with Discord first.");

  // 3 new tickets per user per hour, even if the bot's own limits are off.
  const limit = rateLimit(`ticket-create:${user.discordId}`, 3, 60 * 60_000);
  if (!limit.ok) return apiError(429, "rate_limited", "Too many tickets. Try again later.", { retryAfter: limit.retryAfterSec });

  const parsed = createTicketSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body.");
  const input = parsed.data;

  const category = await prisma.ticketCategory.findFirst({ where: { key: input.category, enabled: true } });
  if (!category) return apiError(400, "invalid_category", "That category is not available.");

  const openCount = await prisma.ticket.count({ where: { openerId: user.discordId, state: { not: "closed" } } });
  if (openCount >= MAX_OPEN_PER_USER) {
    return apiError(409, "too_many_open", `You already have ${MAX_OPEN_PER_USER} open tickets. Close one first.`);
  }

  const name = user.globalName || user.username;
  let created: BotCreatedTicket;
  try {
    created = await createTicketInBot({ openerId: user.discordId, openerName: name, category: category.key, subject: input.subject, description: input.description });
  } catch (err) {
    if (err instanceof BotUnavailableError) return apiError(503, "bot_unavailable", err.message);
    return apiError(422, "bot_rejected", err instanceof Error ? err.message : "The bot could not open the ticket.");
  }

  // Store the mirror row now, so the user sees it without waiting for the bot's sync.
  const ticket = await prisma.ticket.upsert({
    where: { guildId_number: { guildId: created.guildId, number: created.number } },
    create: {
      guildId: created.guildId,
      number: created.number,
      channelId: created.channelId,
      openerId: user.discordId,
      openerName: name,
      category: category.key,
      subject: input.subject,
      description: input.description,
      source: "web",
      state: created.state || "open",
      createdAt: created.createdAt ? new Date(created.createdAt) : undefined,
    },
    update: { channelId: created.channelId },
  });

  await audit({ actorId: user.discordId, actorName: user.username, action: "ticket.create", ticketId: ticket.id, meta: { category: category.key } });

  return apiOk({ id: ticket.id, number: ticket.number, channelUrl: discordChannelUrl(created.guildId, created.channelId) ?? created.channelUrl }, 201);
}
