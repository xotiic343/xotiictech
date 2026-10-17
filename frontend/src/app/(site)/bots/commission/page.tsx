import type { Metadata } from "next";
import { CommissionForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Commission a Discord bot",
  description: "Tell me what your server needs and get a custom Discord bot built to spec.",
};

const STEPS = [
  ["01", "Brief", "Send the form. I reply within 48h with questions or a quote."],
  ["02", "Build", "Milestone updates and a private test bot in your server."],
  ["03", "Ship", "Deploy, hand over source or hosting, plus 30 days of fixes."],
];

export default async function CommissionPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const reference = ref && /^[a-z0-9-]{1,120}$/.test(ref) ? ref : undefined;
  return (
    <>
      <PageHeader
        eyebrow="commission"
        title="Commission a custom bot"
        subtitle="Moderation, tickets, economy, music, game integrations, dashboards: if Discord's API can do it, I can build it."
      />
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="card corner-brackets p-6 sm:p-8">
          {reference && (
            <div className="mb-6 border border-crimson/40 bg-crimson/5 px-4 py-2 text-xs uppercase tracking-wider text-blood">
              Reference bot: {reference}
            </div>
          )}
          <CommissionForm referenceBot={reference} />
        </div>
        <aside className="space-y-4">
          {STEPS.map(([n, t, d]) => (
            <div key={n} className="card flex gap-4 p-5">
              <div className="font-display text-3xl font-black text-crimson/70">{n}</div>
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-wider text-white">{t}</div>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
