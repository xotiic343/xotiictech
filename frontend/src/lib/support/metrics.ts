// Read-only queries behind the /support stats strip, the staff dashboard and the staff leaderboard.
import "server-only";
import { prisma } from "./db";

const DAY = 24 * 60 * 60 * 1000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** A bot counts as online if it sent a heartbeat in the last 3 minutes (it pings every 30 seconds). */
export async function isBotOnline(key = "ticket-bot") {
  const hb = await prisma.botHeartbeat.findUnique({ where: { key } });
  return !!hb && Date.now() - hb.lastSeenAt.getTime() < 3 * 60 * 1000;
}

/** Non-sensitive public numbers for the /support page. */
export async function getPublicSupportStats() {
  const since30 = new Date(Date.now() - 30 * DAY);
  const [total, resolved, recent] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { state: "closed" } }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: since30 }, firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true },
      take: 5000,
    }),
  ]);
  return {
    total,
    resolved,
    avgFirstResponseMs: avg(recent.map((t) => t.firstResponseAt!.getTime() - t.createdAt.getTime())),
  };
}

export async function getDashboardMetrics() {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, todayCount, week, month, byCategory, byState, recent] = await Promise.all([
    prisma.ticket.count({ where: { state: { not: "closed" } } }),
    prisma.ticket.count({ where: { createdAt: { gte: today } } }),
    prisma.ticket.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.ticket.count({ where: { createdAt: { gte: new Date(now - 30 * DAY) } } }),
    prisma.ticket.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
    prisma.ticket.groupBy({ by: ["state"], _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: new Date(now - 30 * DAY) } },
      select: { createdAt: true, firstResponseAt: true, closedAt: true },
      take: 5000,
    }),
  ]);

  return {
    open,
    today: todayCount,
    week,
    month,
    avgFirstResponseMs: avg(recent.filter((t) => t.firstResponseAt).map((t) => t.firstResponseAt!.getTime() - t.createdAt.getTime())),
    avgResolutionMs: avg(recent.filter((t) => t.closedAt).map((t) => t.closedAt!.getTime() - t.createdAt.getTime())),
    byCategory: byCategory.map((r) => ({ name: r.category, value: r._count._all })),
    byState: byState.map((r) => ({ name: r.state, value: r._count._all })),
  };
}

/** Per-staff closed/claimed counts and average first response. */
export async function getStaffLeaderboard(limit = 25) {
  const [closed, claimed, staffMessages] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["closedById"],
      where: { closedById: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { closedById: "desc" } },
      take: limit,
    }),
    prisma.ticket.groupBy({ by: ["claimedById"], where: { claimedById: { not: null } }, _count: { _all: true } }),
    prisma.ticketMessage.findMany({
      where: { isStaff: true },
      select: { ticketId: true, authorId: true, createdAt: true, ticket: { select: { createdAt: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
  ]);

  // The first staff message per ticket is that ticket's first response (messages are oldest first).
  const answered = new Set<string>();
  const firstByStaff = new Map<string, number[]>();
  for (const m of staffMessages) {
    if (answered.has(m.ticketId)) continue;
    answered.add(m.ticketId);
    const list = firstByStaff.get(m.authorId) ?? [];
    list.push(m.createdAt.getTime() - m.ticket.createdAt.getTime());
    firstByStaff.set(m.authorId, list);
  }

  const claimedMap = new Map(claimed.map((c) => [c.claimedById as string, c._count._all]));
  const ids = closed.map((c) => c.closedById as string);
  const users = await prisma.user.findMany({ where: { discordId: { in: ids } }, select: { discordId: true, username: true, globalName: true } });
  const names = new Map(users.map((u) => [u.discordId, u.globalName || u.username]));

  return closed.map((c) => {
    const id = c.closedById as string;
    return {
      staffId: id,
      name: names.get(id) ?? id,
      closed: c._count._all,
      claimed: claimedMap.get(id) ?? 0,
      avgFirstResponseMs: avg(firstByStaff.get(id) ?? []),
    };
  });
}
