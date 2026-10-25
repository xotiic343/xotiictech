// POST /support/api/staff/tickets/:id/action: claim, assign, close, reopen, priority, or a staff reply.
// The bot makes the Discord-side change first; the row is updated only after the bot succeeds, so a
// failed bot call leaves both sides unchanged.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/support/db";
import { getStaffUser } from "@/lib/support/staff";
import { rateLimit } from "@/lib/support/ratelimit";
import { staffActionSchema } from "@/lib/support/validators";
import { apiError, apiOk, assertSameOrigin, readJson } from "@/lib/support/api";
import { BotUnavailableError, actionInBot, postMessageToBot } from "@/lib/support/botApi";
import { audit } from "@/lib/support/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const staff = await getStaffUser();
  if (!staff) return apiError(404, "not_found", "Not found."); // 404 so non-staff can't tell this exists

  const limit = rateLimit(`staff-action:${staff.discordId}`, 60, 60_000);
  if (!limit.ok) return apiError(429, "rate_limited", "Slow down a little.", { retryAfter: limit.retryAfterSec });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return apiError(404, "not_found", "Ticket not found.");

  const parsed = staffActionSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body.");
  const input = parsed.data;

  if (ticket.state === "closed" && input.action !== "reopen" && input.action !== "priority") {
    return apiError(409, "closed", "Reopen the ticket first.");
  }

  const actorName = staff.globalName || staff.username;
  const common = { guildId: ticket.guildId, ticketNumber: ticket.number, actorId: staff.discordId, actorName };

  try {
    let data: Prisma.TicketUpdateInput = {};
    let meta: Prisma.InputJsonValue | undefined;

    switch (input.action) {
      case "claim":
        await actionInBot({ ...common, action: "claim" });
        data = { claimedById: staff.discordId, state: "claimed" };
        break;
      case "unclaim":
        await actionInBot({ ...common, action: "unclaim" });
        data = { claimedById: null, state: "open" };
        break;
      case "assign":
        await actionInBot({ ...common, action: "assign", assigneeId: input.assigneeId });
        data = { assigneeId: input.assigneeId };
        meta = { assigneeId: input.assigneeId };
        break;
      case "close":
        await actionInBot({ ...common, action: "close", reason: input.reason });
        data = { state: "closed", closedAt: new Date(), closedById: staff.discordId, closeReason: input.reason ?? null };
        meta = { reason: input.reason ?? null };
        break;
      case "reopen":
        await actionInBot({ ...common, action: "reopen" });
        data = { state: ticket.claimedById ? "claimed" : "open", closedAt: null, closedById: null, closeReason: null };
        break;
      case "priority":
        await actionInBot({ ...common, action: "priority", priority: input.priority });
        data = { priority: input.priority };
        meta = { priority: input.priority };
        break;
      case "reply": {
        const posted = await postMessageToBot({ ...common, authorId: staff.discordId, authorName: actorName, content: input.content, isStaff: true });
        const now = new Date(posted.createdAt || Date.now());
        await prisma.ticketMessage.upsert({
          where: { discordMessageId: posted.discordMessageId },
          create: { ticketId: ticket.id, discordMessageId: posted.discordMessageId, authorId: staff.discordId, authorName: actorName, isStaff: true, source: "web", content: input.content, createdAt: now },
          update: {},
        });
        data = {
          lastActivityAt: now,
          ...(!ticket.firstResponseAt && { firstResponseAt: now }),
          state: ticket.state === "open" ? "pending" : ticket.state,
        };
        meta = { length: input.content.length };
        break;
      }
    }

    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data });
    await audit({
      actorId: staff.discordId,
      actorName,
      action: `ticket.${input.action}`,
      ticketId: ticket.id,
      targetId: input.action === "assign" ? input.assigneeId : null,
      meta,
    });
    return apiOk({ id: updated.id, state: updated.state, priority: updated.priority });
  } catch (err) {
    if (err instanceof BotUnavailableError) return apiError(503, "bot_unavailable", err.message);
    return apiError(422, "bot_rejected", err instanceof Error ? err.message : "The action could not be completed.");
  }
}
