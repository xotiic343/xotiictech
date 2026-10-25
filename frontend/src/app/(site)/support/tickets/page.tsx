import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/support/db";
import { getCurrentUser } from "@/lib/support/session";
import { LoginPrompt } from "@/components/support/LoginPrompt";
import { TicketRow } from "@/components/support/TicketRow";
import { RowsSkeleton } from "@/components/support/Skeletons";
import { LiveRefresh } from "@/components/support/LiveRefresh";

export const metadata: Metadata = { title: "My tickets" };

export default async function MyTicketsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader eyebrow="support" title="My tickets">
        {user && (
          <Link href="/support/tickets/new" className="btn-primary">
            + Open a ticket
          </Link>
        )}
      </PageHeader>
      <div className="container-x">
        {!user ? (
          <LoginPrompt message="Log in with Discord to see the tickets you've opened." />
        ) : (
          <Suspense fallback={<RowsSkeleton />}>
            <LiveRefresh query="scope=mine" />
            <TicketList userId={user.discordId} />
          </Suspense>
        )}
      </div>
    </>
  );
}

async function TicketList({ userId }: { userId: string }) {
  const tickets = await prisma.ticket.findMany({
    where: { openerId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, number: true, category: true, subject: true, state: true, createdAt: true },
  });

  if (tickets.length === 0) {
    return (
      <EmptyState title="No tickets yet">
        <p>When you open a ticket it shows up here with its status.</p>
        <Link href="/support/tickets/new" className="btn-primary mt-6">
          Open your first ticket
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="card" role="list" aria-label="Your tickets">
      {tickets.map((t) => (
        <div key={t.id} role="listitem">
          <TicketRow ticket={t} href={`/support/tickets/${t.id}`} />
        </div>
      ))}
    </div>
  );
}
