import Link from "next/link";
import { TicketStatusBadge } from "./TicketStatusBadge";

export type TicketRowData = {
  id: string;
  number: number;
  category: string;
  subject: string | null;
  state: string;
  createdAt: Date;
  openerName?: string | null;
  assigneeId?: string | null;
  lastActivityAt?: Date;
  priority?: string;
};

const when = (d: Date) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

/** One ticket in a list: stacked on phones, a grid row from sm up. `staff` adds opener/assignee/activity. */
export function TicketRow({ ticket, href, staff = false }: { ticket: TicketRowData; href: string; staff?: boolean }) {
  return (
    <Link
      href={href}
      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 transition last:border-0 hover:bg-crimson/5 sm:grid-cols-[6rem_1fr_7rem_10rem_auto] sm:px-5"
    >
      <span className="text-sm text-blood">#{String(ticket.number).padStart(4, "0")}</span>
      <span className="min-w-0">
        <span className="aberrate-child block truncate text-sm text-white">{ticket.subject || "Untitled ticket"}</span>
        <span className="mt-0.5 block truncate text-[11px] uppercase tracking-wider text-muted">
          {ticket.category}
          {staff && ticket.openerName ? ` · ${ticket.openerName}` : ""}
          {staff && ticket.priority && ticket.priority !== "normal" ? ` · ${ticket.priority}` : ""}
          {staff && ticket.assigneeId ? " · assigned" : ""}
        </span>
      </span>
      <span className="justify-self-end sm:justify-self-start">
        <TicketStatusBadge state={ticket.state} />
      </span>
      <span className="col-span-2 text-xs text-dim sm:col-span-1">
        {staff && ticket.lastActivityAt ? `active ${when(ticket.lastActivityAt)}` : when(ticket.createdAt)}
      </span>
      <span aria-hidden className="hidden text-crimson transition group-hover:translate-x-1 sm:block">
        →
      </span>
    </Link>
  );
}
