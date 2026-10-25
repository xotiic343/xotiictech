// POST /support/api/bot/jobs: the bot asks for work. Returns up to 5 pending jobs and marks them running.
// Auth: "Authorization: Bearer <BOT_HEARTBEAT_SECRET>". The bot calls this every few seconds.
import { prisma } from "@/lib/support/db";
import { apiError, apiOk, isBotRequest } from "@/lib/support/api";

const MAX_AGE_MS = 2 * 60_000; // older pending jobs were already given up on by the website

export async function POST(req: Request) {
  if (!isBotRequest(req)) return apiError(401, "unauthorized", "Bad bot secret.");

  const cutoff = new Date(Date.now() - MAX_AGE_MS);
  await prisma.botJob.updateMany({ where: { status: "pending", createdAt: { lt: cutoff } }, data: { status: "expired", finishedAt: new Date() } });

  const pending = await prisma.botJob.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 5 });
  const claimed = [];
  for (const job of pending) {
    // Conditional update: if two polls overlap, only one of them gets each job.
    const res = await prisma.botJob.updateMany({ where: { id: job.id, status: "pending" }, data: { status: "running", claimedAt: new Date() } });
    if (res.count === 1) claimed.push({ id: job.id, kind: job.kind, payload: job.payload });
  }
  return apiOk(claimed);
}
