// POST /support/api/bots/heartbeat: Ticket X's "I'm alive" ping (bot: src/services/websiteHeartbeat.js,
// every 30s). Drives the online dot on /support.
// Auth: "Authorization: Bearer <BOT_HEARTBEAT_SECRET>". Body: { "botKey": "ticket-bot" }.
import { z } from "zod";
import { prisma } from "@/lib/support/db";
import { apiError, apiOk, isBotRequest, readJson } from "@/lib/support/api";

const bodySchema = z.object({ botKey: z.string().regex(/^[a-z0-9-]{1,40}$/) });

export async function POST(req: Request) {
  if (!isBotRequest(req)) return apiError(401, "unauthorized", "Bad heartbeat secret.");

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", 'Send { "botKey": "..." }.');

  const now = new Date();
  await prisma.botHeartbeat.upsert({
    where: { key: parsed.data.botKey },
    create: { key: parsed.data.botKey, lastSeenAt: now },
    update: { lastSeenAt: now },
  });
  return apiOk({ ok: true });
}
