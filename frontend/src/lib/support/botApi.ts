// Website -> Ticket X bot, through a job queue.
//
// The bot is hosted on Discloud, which doesn't let it receive web requests. So instead of calling the
// bot, we store a BotJob row; the bot polls /support/api/bot/jobs every few seconds, runs the job with
// its normal ticket code (cooldowns, limits, blacklist, transcripts, DMs all still apply) and posts the
// result to /support/api/bot/jobs/:id. These helpers enqueue a job and wait for that result.
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { isBotOnline } from "./metrics";

export class BotUnavailableError extends Error {
  constructor(message = "The ticket bot is offline right now. Please try again in a minute.") {
    super(message);
  }
}

const POLL_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runJob<T>(kind: string, payload: Record<string, unknown>, timeoutMs = 25_000): Promise<T> {
  if (!(await isBotOnline("ticket-bot"))) throw new BotUnavailableError();

  const job = await prisma.botJob.create({ data: { kind, payload: payload as Prisma.InputJsonValue } });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const j = await prisma.botJob.findUnique({ where: { id: job.id }, select: { status: true, result: true, error: true } });
    if (j?.status === "done") return j.result as T;
    if (j?.status === "failed") throw new Error(j.error || "The bot couldn't do that.");
  }

  // Not picked up in time: cancel it if the bot hasn't started, so it can't run unexpectedly later.
  const cancelled = await prisma.botJob.updateMany({ where: { id: job.id, status: "pending" }, data: { status: "expired", finishedAt: new Date() } });
  throw new BotUnavailableError(
    cancelled.count ? "The ticket bot didn't respond in time. Please try again." : "The bot is still working on it. Refresh the page in a moment.",
  );
}

export type BotCreatedTicket = {
  guildId: string;
  number: number;
  channelId: string;
  channelUrl: string;
  state: string;
  createdAt: string;
};

export function createTicketInBot(input: { openerId: string; openerName: string; category: string; subject: string; description: string }) {
  return runJob<BotCreatedTicket>("ticket.create", { ...input, guildId: env().DISCORD_GUILD_ID }, 30_000);
}

export type BotPostedMessage = { discordMessageId: string; createdAt: string };

export function postMessageToBot(input: {
  guildId: string;
  ticketNumber: number;
  authorId: string;
  authorName: string;
  content: string;
  isStaff: boolean;
}) {
  return runJob<BotPostedMessage>("ticket.message", input);
}

export function actionInBot(input: {
  guildId: string;
  ticketNumber: number;
  action: "claim" | "unclaim" | "assign" | "close" | "reopen" | "priority";
  actorId: string;
  actorName: string;
  assigneeId?: string | null;
  reason?: string;
  priority?: string;
}) {
  return runJob<{ ok: true }>("ticket.action", input, 30_000);
}
