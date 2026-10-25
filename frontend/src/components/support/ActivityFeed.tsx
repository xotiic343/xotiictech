import Link from "next/link";

// Audit entries as a terminal-style feed.
export type FeedEntry = {
  id: string;
  actorId: string;
  actorName: string | null;
  action: string;
  ticketId: string | null;
  source: string;
  createdAt: string;
};

const LABELS: Record<string, string> = {
  "ticket.create": "opened a ticket",
  "ticket.claim": "claimed a ticket",
  "ticket.unclaim": "released a ticket",
  "ticket.assign": "assigned a ticket",
  "ticket.close": "closed a ticket",
  "ticket.reopen": "reopened a ticket",
  "ticket.priority": "changed priority",
  "ticket.reply": "replied to a ticket",
  "note.create": "added a staff note",
};

export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  if (entries.length === 0) return <div className="card p-6 text-center text-sm text-muted">No activity yet.</div>;

  return (
    <ol className="card max-h-[32rem] divide-y divide-line overflow-y-auto">
      {entries.map((e) => (
        <li key={e.id} className="px-4 py-3 text-sm">
          <p>
            <span className="text-crimson">&gt; </span>
            <span className="text-white">{e.actorName || e.actorId}</span> <span className="text-muted">{LABELS[e.action] ?? e.action}</span>
            {e.ticketId && (
              <Link href={`/support/exotic/tickets/${e.ticketId}`} className="ml-2 text-xs uppercase tracking-wider text-blood hover:text-white">
                view →
              </Link>
            )}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-dim">
            {new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" }).format(new Date(e.createdAt))}
            {e.source === "bot" ? " · bot" : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
