// Ticket state as a terminal-style tag. Unknown states from the bot fall back to a neutral tag.
const STYLES: Record<string, string> = {
  open: "border-ok/50 text-ok",
  claimed: "border-cyan/50 text-cyan",
  pending: "border-amber/50 text-amber",
  closed: "border-edge text-dim",
};

export function TicketStatusBadge({ state }: { state: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border bg-black/60 px-2 py-0.5 text-[11px] uppercase tracking-wider ${STYLES[state] ?? "border-edge text-muted"}`}>
      <span aria-hidden className="h-1.5 w-1.5 bg-current" />
      {state}
    </span>
  );
}
