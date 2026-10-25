// POST /support/api/tickets/:id/reply: the ticket opener replies from the website (posted to Discord by the bot).
import { prisma } from "@/lib/support/db";
import { getCurrentUser } from "@/lib/support/session";
import { rateLimit } from "@/lib/support/ratelimit";
import { replySchema } from "@/lib/support/validators";
import { apiError, apiOk, assertSameOrigin, readJson } from "@/lib/support/api";
import { BotUnavailableError, postMessageToBot, type BotPostedMessage } from "@/lib/support/botApi";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized", "Log in with Discord first.");

  const { id } = await params;
  const limit = rateLimit(`reply:${user.discordId}:${id}`, 10, 60_000);
  if (!limit.ok) return apiError(429, "rate_limited", "Slow down a little.", { retryAfter: limit.retryAfterSec });

  // Opener only. Anyone else gets the same 404 as a missing ticket.
  const ticket = await prisma.ticket.findFirst({ where: { id, openerId: user.discordId } });
  if (!ticket) return apiError(404, "not_found", "Ticket not found.");
  if (ticket.state === "closed") return apiError(409, "closed", "This ticket is closed. Ask staff to reopen it.");

  const parsed = replySchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body.");

  const name = user.globalName || user.username;
  let posted: BotPostedMessage;
  try {
    posted = await postMessageToBot({ guildId: ticket.guildId, ticketNumber: ticket.number, authorId: user.discordId, authorName: name, content: parsed.data.content, isStaff: false });
  } catch (err) {
    if (err instanceof BotUnavailableError) return apiError(503, "bot_unavailable", err.message);
    return apiError(422, "bot_rejected", err instanceof Error ? err.message : "The message could not be posted.");
  }

  const now = new Date(posted.createdAt || Date.now());
  await prisma.ticketMessage.upsert({
    where: { discordMessageId: posted.discordMessageId },
    create: { ticketId: ticket.id, discordMessageId: posted.discordMessageId, authorId: user.discordId, authorName: name, source: "web", content: parsed.data.content, createdAt: now },
    update: {},
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      lastActivityAt: now,
      // The user answered staff, so it's waiting on staff again.
      ...(ticket.state === "pending" && { state: ticket.claimedById ? "claimed" : "open" }),
    },
  });

  return apiOk({ discordMessageId: posted.discordMessageId }, 201);
}
