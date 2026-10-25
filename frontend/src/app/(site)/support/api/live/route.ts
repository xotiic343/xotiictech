// GET /support/api/live: a tiny "has anything changed?" version string for live-updating pages.
//   ?ticket=<id>    one ticket (opener or staff): ticket updates + message count (+ notes for staff)
//   ?scope=mine     the user's ticket list
//   ?scope=queue    staff: all tickets + latest audit entry (dashboard, queue)
// Pages poll this every few seconds and only re-render when the value changes (components/support/LiveRefresh).
import { prisma } from "@/lib/support/db";
import { getCurrentUser } from "@/lib/support/session";
import { isStaffUser } from "@/lib/support/staff";
import { apiError, apiOk } from "@/lib/support/api";

const t = (d: Date | null | undefined) => (d ? d.getTime() : 0);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized", "Log in with Discord first.");
  const params = new URL(req.url).searchParams;

  const ticketId = params.get("ticket");
  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { openerId: true, updatedAt: true } });
    if (!ticket) return apiError(404, "not_found", "Ticket not found.");
    const staff = ticket.openerId === user.discordId ? false : await isStaffUser(user.discordId);
    if (ticket.openerId !== user.discordId && !staff) return apiError(404, "not_found", "Ticket not found.");
    const [messages, notes] = await Promise.all([
      prisma.ticketMessage.count({ where: { ticketId } }),
      staff ? prisma.staffNote.count({ where: { ticketId } }) : Promise.resolve(0),
    ]);
    return apiOk({ v: `${t(ticket.updatedAt)}:${messages}:${notes}` });
  }

  if (params.get("scope") === "queue") {
    if (!(await isStaffUser(user.discordId))) return apiError(404, "not_found", "Not found.");
    const [agg, lastAudit] = await Promise.all([
      prisma.ticket.aggregate({ _max: { updatedAt: true }, _count: { _all: true } }),
      prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    return apiOk({ v: `${t(agg._max.updatedAt)}:${agg._count._all}:${t(lastAudit?.createdAt)}` });
  }

  const agg = await prisma.ticket.aggregate({ where: { openerId: user.discordId }, _max: { updatedAt: true }, _count: { _all: true } });
  return apiOk({ v: `${t(agg._max.updatedAt)}:${agg._count._all}` });
}
