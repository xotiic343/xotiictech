// Staff ticket queue. Filters are a plain GET form: no client JS, and every filter is a shareable URL.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { prisma } from "@/lib/support/db";
import { requireStaff } from "@/lib/support/staff";
import { STATES, STATE_LABEL } from "@/lib/support/tickets";
import { ticketQuerySchema } from "@/lib/support/validators";
import { TicketRow } from "@/components/support/TicketRow";

const PAGE_SIZE = 25;
const SORTS = {
  activity: { lastActivityAt: "desc" },
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
} as const;
type SortKey = keyof typeof SORTS;

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();

  const raw = await searchParams;
  const flat: Record<string, string | undefined> = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = ticketQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : { page: 1, q: undefined, state: undefined, category: undefined };
  const sort: SortKey = flat.sort && flat.sort in SORTS ? (flat.sort as SortKey) : "activity";

  const where: Prisma.TicketWhereInput = {};
  if (query.state) where.state = query.state;
  if (query.category) where.category = query.category;
  if (query.q) {
    const n = Number(query.q.replace(/^#/, ""));
    where.OR = [
      { subject: { contains: query.q, mode: "insensitive" } },
      { openerName: { contains: query.q, mode: "insensitive" } },
      { openerId: query.q },
      ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
    ];
  }

  const [tickets, total, categories] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: SORTS[sort],
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, number: true, category: true, subject: true, state: true, priority: true, openerName: true, assigneeId: true, createdAt: true, lastActivityAt: true },
    }),
    prisma.ticket.count({ where }),
    prisma.ticketCategory.findMany({ select: { key: true, label: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageUrl = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.state) p.set("state", query.state);
    if (query.category) p.set("category", query.category);
    if (sort !== "activity") p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `/support/exotic/tickets?${s}` : "/support/exotic/tickets";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-2">// queue</div>
          <h1 className="h-display text-2xl sm:text-3xl">Tickets</h1>
        </div>
        <p className="text-xs uppercase tracking-wider text-muted">
          {total} match{total === 1 ? "" : "es"}
        </p>
      </header>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="label">
            Search
          </label>
          <input id="q" name="q" defaultValue={query.q ?? ""} placeholder="subject, name, user ID or #number" className="input" />
        </div>
        <div>
          <label htmlFor="state" className="label">
            Status
          </label>
          <select id="state" name="state" defaultValue={query.state ?? ""} className="input sm:w-36">
            <option value="">All</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category" className="label">
            Category
          </label>
          <select id="category" name="category" defaultValue={query.category ?? ""} className="input sm:w-40">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="label">
            Sort
          </label>
          <select id="sort" name="sort" defaultValue={sort} className="input sm:w-40">
            <option value="activity">Last activity</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <button type="submit" className="btn-primary btn-sm h-[42px]">
          Apply
        </button>
      </form>

      {tickets.length === 0 ? (
        <EmptyState title="No tickets match">
          <Link href="/support/exotic/tickets" className="text-blood hover:text-white">
            Clear filters
          </Link>
        </EmptyState>
      ) : (
        <div className="card" role="list" aria-label="Tickets">
          {tickets.map((t) => (
            <div key={t.id} role="listitem">
              <TicketRow ticket={t} href={`/support/exotic/tickets/${t.id}`} staff />
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {query.page > 1 ? (
            <Link href={pageUrl(query.page - 1)} className="btn-ghost btn-sm">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs uppercase tracking-wider text-dim">
            page {query.page} / {pages}
          </span>
          {query.page < pages ? (
            <Link href={pageUrl(query.page + 1)} className="btn-ghost btn-sm">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
