// POST /support/api/staff/tickets/:id/notes: internal staff note. Stored on the website only.
import { prisma } from "@/lib/support/db";
import { getStaffUser } from "@/lib/support/staff";
import { rateLimit } from "@/lib/support/ratelimit";
import { noteSchema } from "@/lib/support/validators";
import { apiError, apiOk, assertSameOrigin, readJson } from "@/lib/support/api";
import { audit } from "@/lib/support/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const staff = await getStaffUser();
  if (!staff) return apiError(404, "not_found", "Not found.");

  const limit = rateLimit(`note:${staff.discordId}`, 30, 60_000);
  if (!limit.ok) return apiError(429, "rate_limited", "Slow down a little.", { retryAfter: limit.retryAfterSec });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) return apiError(404, "not_found", "Ticket not found.");

  const parsed = noteSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body.");

  const note = await prisma.staffNote.create({
    data: { ticketId: ticket.id, authorId: staff.discordId, authorName: staff.globalName || staff.username, body: parsed.data.body },
  });
  await audit({ actorId: staff.discordId, actorName: staff.username, action: "note.create", ticketId: ticket.id });

  return apiOk({ id: note.id }, 201);
}
