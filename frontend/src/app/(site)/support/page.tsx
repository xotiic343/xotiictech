import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, SectionHeading, StatusDot } from "@/components/ui";
import { SupportStat } from "@/components/support/SupportStat";
import { StatsSkeleton } from "@/components/support/Skeletons";
import { apiGet } from "@/lib/backend";
import { getGuildMemberCount } from "@/lib/support/discord";
import { getPublicSupportStats, isBotOnline } from "@/lib/support/metrics";
import { formatDuration } from "@/lib/support/tickets";
import type { SiteData } from "@/lib/types";

const FEATURES: { title: string; body: string }[] = [
  { title: "Panels that fit your server", body: "Buttons or a select menu, with a category, symbol and Discord folder for each option." },
  { title: "Claims and priorities", body: "Staff claim and transfer tickets and set Low, Normal, High or Urgent. The embed colour follows the priority." },
  { title: "HTML transcripts", body: "Styled, self-contained transcripts, posted to a log channel and sent to the user by DM." },
  { title: "Auto-close on inactivity", body: "The user is warned first, then the ticket closes on its own, so channels never pile up." },
  { title: "Feedback after close", body: "A 1–5 star rating and optional comment, plus a reopen button for a set window." },
  { title: "Statistics", body: "First-response and resolution times, satisfaction score and top staff." },
];

export default async function SupportHome() {
  // The Discord invite comes from Site content → socials in /xotiic, so there's one place to edit it.
  const site = await apiGet<SiteData>("/site", 60);
  const invite = site?.socials?.discord;

  return (
    <>
      <PageHeader eyebrow="support" title="Xotiic Support" subtitle="Open a ticket, follow your requests in one place, and talk to staff without leaving the browser.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/support/tickets/new" className="btn-primary">
            Open a ticket →
          </Link>
          {invite && (
            <a href={invite} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Join Discord
            </a>
          )}
          <Suspense fallback={null}>
            <BotStatus />
          </Suspense>
        </div>
      </PageHeader>

      <div className="container-x space-y-20">
        <section aria-label="Support stats">
          <Suspense fallback={<StatsSkeleton />}>
            <Stats />
          </Suspense>
        </section>

        <section>
          <SectionHeading eyebrow="ticket x" title="What the ticket bot can do" href="/bots" linkLabel="All bots" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card card-hover p-5">
                <h3 className="aberrate-child font-display text-sm font-bold uppercase tracking-wider text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card corner-brackets flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <div className="eyebrow mb-2">// already a ticket open?</div>
            <p className="text-sm text-muted">See every ticket you&apos;ve opened, read the conversation and reply from here.</p>
          </div>
          <Link href="/support/tickets" className="btn-ghost shrink-0">
            My tickets
          </Link>
        </section>
      </div>
    </>
  );
}

async function BotStatus() {
  const online = await isBotOnline("ticket-bot").catch(() => false);
  return (
    <span className="inline-flex items-center gap-2 border border-edge bg-black/60 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-muted">ticket bot</span>
      <StatusDot status={online ? "online" : "offline"} />
    </span>
  );
}

async function Stats() {
  const [s, members] = await Promise.all([getPublicSupportStats(), getGuildMemberCount()]);
  const n = new Intl.NumberFormat("en");
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <SupportStat label="Tickets handled" value={n.format(s.total)} />
      <SupportStat label="Tickets resolved" value={n.format(s.resolved)} />
      <SupportStat label="Avg first response" value={formatDuration(s.avgFirstResponseMs)} hint="last 30 days" />
      <SupportStat label="Community members" value={members === null ? "—" : n.format(members)} />
    </div>
  );
}
