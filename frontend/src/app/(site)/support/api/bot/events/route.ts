// POST /support/api/bot/events: Ticket X syncs tickets, messages and audit entries here (docs/SUPPORT.md, A2).
// Same auth as the heartbeat. Every event is idempotent, so the bot can retry safely.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/support/db";
import { botEventSchema } from "@/lib/support/validators";
import { apiError, apiOk, isBotRequest, readJson } from "@/lib/support/api";
import { audit } from "@/lib/support/audit";

const date = (s: string | null | undefined) => (s ? new Date(s) : null);

export async function POST(req: Request) {
  if (!isBotRequest(req)) return apiError(401, "unauthorized", "Bad bot secret.");
  if (Number(req.headers.get("content-length") ?? 0) > 256 * 1024) return apiError(413, "too_large", "Event payload too large.");

  const parsed = botEventSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body.");
  const event = parsed.data;

  switch (event.type) {
    case "ticket.upsert": {
      const t = event.ticket;
      const ticket = await prisma.ticket.upsert({
        where: { guildId_number: { guildId: t.guildId, number: t.number } },
        create: {
          guildId: t.guildId,
          number: t.number,
          channelId: t.channelId ?? null,
          openerId: t.openerId,
          openerName: t.openerName ?? null,
          category: t.category,
          subject: t.subject ?? null,
          state: t.state ?? "open",
          priority: t.priority ?? "normal",
          claimedById: t.claimedById ?? null,
          closedById: t.closedById ?? null,
          closeReason: t.closeReason ?? null,
          source: "bot",
          createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
          closedAt: date(t.closedAt),
          firstResponseAt: date(t.firstResponseAt),
          lastActivityAt: t.lastActivityAt ? new Date(t.lastActivityAt) : undefined,
        },
        // Only fields the bot actually sent are overwritten, so a partial payload can't erase data.
        update: {
          ...(t.channelId !== undefined && { channelId: t.channelId }),
          ...(t.openerName !== undefined && { openerName: t.openerName }),
          ...(t.subject !== undefined && { subject: t.subject }),
          ...(t.state !== undefined && { state: t.state }),
          ...(t.priority !== undefined && { priority: t.priority }),
          ...(t.claimedById !== undefined && { claimedById: t.claimedById }),
          ...(t.closedById !== undefined && { closedById: t.closedById }),
          ...(t.closeReason !== undefined && { closeReason: t.closeReason }),
          ...(t.closedAt !== undefined && { closedAt: date(t.closedAt) }),
          ...(t.firstResponseAt !== undefined && { firstResponseAt: date(t.firstResponseAt) }),
          ...(t.lastActivityAt !== undefined && { lastActivityAt: new Date(t.lastActivityAt) }),
        },
      });
      return apiOk({ id: ticket.id, number: ticket.number });
    }

    case "message.create": {
      const m = event.message;
      const ticket = await prisma.ticket.findUnique({
        where: { guildId_number: { guildId: m.guildId, number: m.ticketNumber } },
        select: { id: true, firstResponseAt: true },
      });
      if (!ticket) return apiError(404, "ticket_not_found", "Send ticket.upsert before messages.");

      const createdAt = m.createdAt ? new Date(m.createdAt) : new Date();
      const data = {
        ticketId: ticket.id,
        discordMessageId: m.discordMessageId ?? null,
        authorId: m.authorId,
        authorName: m.authorName,
        isStaff: m.isStaff,
        source: m.source,
        content: m.content,
        createdAt,
      };
      if (m.discordMessageId) {
        await prisma.ticketMessage.upsert({ where: { discordMessageId: m.discordMessageId }, create: data, update: { content: m.content } });
      } else {
        await prisma.ticketMessage.create({ data });
      }
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { lastActivityAt: createdAt, ...(m.isStaff && !ticket.firstResponseAt && { firstResponseAt: createdAt }) },
      });
      return apiOk({ ok: true });
    }

    case "audit": {
      const e = event.entry;
      let ticketId: string | null = null;
      if (e.ticketNumber && e.guildId) {
        const t = await prisma.ticket.findUnique({ where: { guildId_number: { guildId: e.guildId, number: e.ticketNumber } }, select: { id: true } });
        ticketId = t?.id ?? null;
      }
      await audit({ actorId: e.actorId, actorName: e.actorName ?? null, action: e.action, ticketId, source: "bot", meta: e.meta as Prisma.InputJsonValue | undefined });
      return apiOk({ ok: true });
    }
  }
}
