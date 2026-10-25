import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/support/db";
import { getCurrentUser } from "@/lib/support/session";
import { LoginPrompt } from "@/components/support/LoginPrompt";
import { NewTicketForm } from "@/components/support/NewTicketForm";

export const metadata: Metadata = { title: "Open a ticket" };

export default async function NewTicketPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <PageHeader eyebrow="support" title="Open a ticket" />
        <div className="container-x">
          <LoginPrompt message="Log in with Discord to open a ticket. Staff reply in a private channel." />
        </div>
      </>
    );
  }

  const categories = await prisma.ticketCategory.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { key: true, label: true, description: true },
  });

  return (
    <>
      <PageHeader eyebrow="new ticket" title="Open a ticket" subtitle="Tell us what you need. Staff will reply in a private Discord channel, and you can follow along here." />
      <div className="container-x max-w-3xl">
        {categories.length === 0 ? (
          <EmptyState title="Tickets are closed right now">No categories are open for new tickets. Check back soon.</EmptyState>
        ) : (
          <NewTicketForm categories={categories} />
        )}
      </div>
    </>
  );
}
