// POST /support/api/bot/jobs/:id: the bot reports a job's outcome.
// Body: { "ok": true, "result": {...} }  or  { "ok": false, "error": "message shown to the user" }
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/support/db";
import { apiError, apiOk, isBotRequest, readJson } from "@/lib/support/api";

const bodySchema = z.union([
  z.object({ ok: z.literal(true), result: z.record(z.unknown()).default({}) }),
  z.object({ ok: z.literal(false), error: z.string().max(500) }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!isBotRequest(req)) return apiError(401, "unauthorized", "Bad bot secret.");

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", "Send { ok: true, result } or { ok: false, error }.");

  const { id } = await params;
  const data = parsed.data.ok
    ? { status: "done", result: parsed.data.result as Prisma.InputJsonValue, finishedAt: new Date() }
    : { status: "failed", error: parsed.data.error, finishedAt: new Date() };

  const res = await prisma.botJob.updateMany({ where: { id, status: "running" }, data });
  if (res.count === 0) return apiError(404, "not_found", "No running job with that id.");
  return apiOk({ ok: true });
}
