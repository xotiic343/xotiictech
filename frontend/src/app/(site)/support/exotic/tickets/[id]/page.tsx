import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/support/db";
import { requireStaff } from "@/lib/support/staff";
import { discordChannelUrl, ensureTranscript, fmtDate, ticketLabel } from "@/lib/support/tickets";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { Transcript } from "@/components/support/Transcript";
import { StaffActions } from "@/components/support/StaffActions";
import { StaffNotes } from "@/components/support/StaffNotes";
import { ActivityFeed } from "@/components/support/ActivityFeed";
import { LiveRefresh } from "@/components/support/LiveRefresh";

type Props = { params: Promise<{ id: string }> };

export default async function StaffTicketPage({ params }: Props) {
  const staff = await requireStaff();
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) notFound();
  await ensureTranscript(ticket);

  const [messages, notes, activity] = await Promise.all([
    prisma.ticketMessage.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.staffNote.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.auditLog.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const channelUrl = discordChannelUrl(ticket.guildId, ticket.channelId);

  return (
    <div className="space-y-6">
      <LiveRefresh query={`ticket=${ticket.id}`} />
      <Link href="/support/exotic/tickets" className="aberrate text-xs uppercase tracking-[0.2em] text-blood hover:text-white">
        ← Queue
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <header className="card corner-brackets space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-blood">{ticketLabel(ticket.number)}</span>
              <TicketStatusBadge state={ticket.state} />
              <span className="tag">{ticket.category}</span>
              <span className="tag">{ticket.priority} priority</span>
            </div>
            <h1 className="h-display text-xl">{ticket.subject || "Untitled ticket"}</h1>
            {ticket.description && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{ticket.description}</p>}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-xs sm:grid-cols-4">
              {[
                ["Opened by", ticket.openerName || ticket.openerId],
                ["Opened", fmtDate(ticket.createdAt)],
                ["First response", fmtDate(ticket.firstResponseAt)],
                ["Closed", fmtDate(ticket.closedAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-wider text-dim">{k}</dt>
                  <dd className="mt-0.5 text-neutral-200">{v}</dd>
                </div>
              ))}
            </dl>
            {channelUrl && (
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] uppercase tracking-wider text-blood hover:text-white">
                open channel in discord ↗
              </a>
            )}
          </header>

          <section aria-labelledby="transcript-heading" className="space-y-4">
            <h2 id="transcript-heading" className="eyebrow">
              // transcript
            </h2>
            <Transcript messages={messages} viewerId={staff.discordId} />
          </section>

          <details className="card p-5">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted hover:text-white">Ticket activity</summary>
            <div className="mt-4">
              <ActivityFeed entries={activity.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))} />
            </div>
          </details>
        </div>

        <aside className="space-y-6">
          <StaffActions
            ticketId={ticket.id}
            state={ticket.state}
            priority={ticket.priority}
            claimedById={ticket.claimedById}
            assigneeId={ticket.assigneeId}
            viewerId={staff.discordId}
          />
          <StaffNotes ticketId={ticket.id} notes={notes.map((n) => ({ id: n.id, authorName: n.authorName, body: n.body, createdAt: n.createdAt.toISOString() }))} />
        </aside>
      </div>
    </div>
  );
}
