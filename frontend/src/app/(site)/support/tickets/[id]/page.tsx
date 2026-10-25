import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/support/db";
import { getCurrentUser } from "@/lib/support/session";
import { discordChannelUrl, ensureTranscript, fmtDate, ticketLabel } from "@/lib/support/tickets";
import { LoginPrompt } from "@/components/support/LoginPrompt";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { Transcript } from "@/components/support/Transcript";
import { ReplyBox } from "@/components/support/ReplyBox";
import { LiveRefresh } from "@/components/support/LiveRefresh";

export const metadata: Metadata = { title: "Ticket" };

type Props = { params: Promise<{ id: string }> };

export default async function TicketPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="container-x py-14">
        <LoginPrompt message="Log in with Discord to view this ticket." />
      </div>
    );
  }

  const { id } = await params;
  // Opener only. Anyone else gets the same 404 as a missing ticket, so IDs can't be probed.
  const ticket = await prisma.ticket.findFirst({ where: { id, openerId: user.discordId } });
  if (!ticket) notFound();

  await ensureTranscript(ticket);
  const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: "asc" }, take: 500 });
  const channelUrl = discordChannelUrl(ticket.guildId, ticket.channelId);
  const closed = ticket.state === "closed";

  return (
    <div className="container-x max-w-4xl space-y-8 py-12">
      <LiveRefresh query={`ticket=${ticket.id}`} />
      <Link href="/support/tickets" className="aberrate text-xs uppercase tracking-[0.2em] text-blood hover:text-white">
        ← My tickets
      </Link>

      <header className="card corner-brackets space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-blood">{ticketLabel(ticket.number)}</span>
          <TicketStatusBadge state={ticket.state} />
          <span className="tag">{ticket.category}</span>
        </div>
        <h1 className="h-display text-xl sm:text-2xl">{ticket.subject || "Untitled ticket"}</h1>
        {ticket.description && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{ticket.description}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-[11px] uppercase tracking-wider text-dim">
          <span>opened {fmtDate(ticket.createdAt)}</span>
          {closed && <span>closed {fmtDate(ticket.closedAt)}</span>}
          {channelUrl && (
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-blood hover:text-white">
              open in discord ↗
            </a>
          )}
        </div>
      </header>

      <section aria-labelledby="transcript-heading" className="space-y-4">
        <h2 id="transcript-heading" className="eyebrow">
          // conversation
        </h2>
        <Transcript messages={messages} viewerId={user.discordId} />
      </section>

      <ReplyBox ticketId={ticket.id} disabled={closed} disabledReason="This ticket is closed. Ask staff to reopen it if you still need help." />
    </div>
  );
}
