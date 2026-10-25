// zod schemas for every /support/api write endpoint.
import { z } from "zod";

const snowflake = z.string().regex(/^\d{5,25}$/, "Invalid Discord ID");

export const createTicketSchema = z.object({
  category: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/, "Invalid category"),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(100),
  description: z.string().trim().min(10, "Please describe the issue (at least 10 characters)").max(2000),
});

export const replySchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(1800, "Keep replies under 1800 characters"),
});

export const staffActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim") }),
  z.object({ action: z.literal("unclaim") }),
  z.object({ action: z.literal("assign"), assigneeId: snowflake.nullable() }),
  z.object({ action: z.literal("close"), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("priority"), priority: z.enum(["low", "normal", "high", "urgent"]) }),
  z.object({ action: z.literal("reply"), content: z.string().trim().min(1).max(1800) }),
]);

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const ticketQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  state: z.enum(["open", "claimed", "pending", "closed"]).optional(),
  category: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

// Payloads sent by the Ticket X bot (docs/SUPPORT.md, section A). passthrough() lets the bot add fields.
const iso = z.string().datetime();

export const botEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ticket.upsert"),
    ticket: z
      .object({
        guildId: snowflake,
        number: z.number().int().positive(),
        channelId: snowflake.nullable().optional(),
        openerId: snowflake,
        openerName: z.string().max(100).nullable().optional(),
        category: z.string().max(40),
        subject: z.string().max(200).nullable().optional(),
        state: z.string().max(20).optional(),
        priority: z.string().max(20).optional(),
        claimedById: snowflake.nullable().optional(),
        closedById: snowflake.nullable().optional(),
        closeReason: z.string().max(300).nullable().optional(),
        createdAt: iso.optional(),
        closedAt: iso.nullable().optional(),
        firstResponseAt: iso.nullable().optional(),
        lastActivityAt: iso.optional(),
      })
      .passthrough(),
  }),
  z.object({
    type: z.literal("message.create"),
    message: z
      .object({
        guildId: snowflake,
        ticketNumber: z.number().int().positive(),
        discordMessageId: snowflake.nullable().optional(),
        authorId: snowflake,
        authorName: z.string().max(100),
        isStaff: z.boolean().default(false),
        content: z.string().max(4000).default(""),
        source: z.string().max(20).default("discord"),
        createdAt: iso.optional(),
      })
      .passthrough(),
  }),
  z.object({
    type: z.literal("audit"),
    entry: z.object({
      actorId: z.string().max(25),
      actorName: z.string().max(100).nullable().optional(),
      action: z.string().max(60),
      ticketNumber: z.number().int().positive().nullable().optional(),
      guildId: snowflake.optional(),
      meta: z.record(z.unknown()).optional(),
    }),
  }),
]);
