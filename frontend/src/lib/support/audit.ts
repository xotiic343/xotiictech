// Audit entries for every staff action and important bot event.
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function audit(entry: {
  actorId: string;
  actorName?: string | null;
  action: string;
  ticketId?: string | null;
  targetId?: string | null;
  source?: "web" | "bot";
  meta?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorName: entry.actorName ?? null,
        action: entry.action,
        ticketId: entry.ticketId ?? null,
        targetId: entry.targetId ?? null,
        source: entry.source ?? "web",
        meta: entry.meta ?? undefined,
      },
    });
  } catch (err) {
    // Logged loudly, but never undoes the action itself.
    console.error("[support] audit write failed", entry.action, err);
  }
}
