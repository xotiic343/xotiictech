// Website -> Ticket X bot. The bot owns Discord-side work (channels, numbering, transcripts, close), so
// the website asks the bot instead of editing Discord itself. Contract: docs/SUPPORT.md, section B.
import "server-only";
import { env } from "./env";

export class BotUnavailableError extends Error {
  constructor(message = "The ticket bot is unavailable right now. Please try again shortly.") {
    super(message);
  }
}

async function botRequest<T>(path: string, body: unknown): Promise<T> {
  const { BOT_API_URL, BOT_API_SECRET } = env();
  if (!BOT_API_URL || !BOT_API_SECRET) throw new BotUnavailableError("Opening and replying from the website isn't connected to the bot yet.");

  let res: Response;
  try {
    res = await fetch(`${BOT_API_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${BOT_API_SECRET}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BotUnavailableError();
  }

  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
  if (!res.ok || json.data === undefined) {
    if (res.status >= 500) throw new BotUnavailableError();
    throw new Error(json.error?.message ?? `Bot rejected the request (${res.status}).`);
  }
  return json.data;
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
  return botRequest<BotCreatedTicket>("/internal/tickets", input);
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
  return botRequest<BotPostedMessage>(`/internal/tickets/${input.ticketNumber}/messages`, input);
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
  return botRequest<{ ok: true }>(`/internal/tickets/${input.ticketNumber}/actions`, input);
}
