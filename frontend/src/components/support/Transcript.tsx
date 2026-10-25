// Read-only ticket conversation, styled as a terminal log.
export type TranscriptMessage = {
  id: string;
  authorId: string;
  authorName: string;
  isStaff: boolean;
  source: string;
  content: string;
  createdAt: Date;
};

const time = (d: Date) => new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));

export function Transcript({ messages, viewerId }: { messages: TranscriptMessage[]; viewerId: string }) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">No messages yet. Staff will reply here soon.</p>;
  }

  return (
    <ol className="space-y-3" aria-label="Ticket messages">
      {messages.map((m) => {
        const mine = m.authorId === viewerId;
        const system = m.source === "system";
        return (
          <li
            key={m.id}
            className={`border-l-2 bg-black/60 px-4 py-3 ${
              system ? "border-edge" : m.isStaff ? "border-cyan" : mine ? "border-crimson" : "border-edge"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
              <span className={system ? "text-dim" : m.isStaff ? "text-cyan" : mine ? "text-blood" : "text-neutral-300"}>
                {system ? "system" : m.authorName}
              </span>
              {m.isStaff && <span className="border border-cyan/50 px-1.5 text-[10px] text-cyan">staff</span>}
              <time className="text-dim" dateTime={new Date(m.createdAt).toISOString()}>
                {time(m.createdAt)}
              </time>
            </div>
            <p className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed ${system ? "italic text-muted" : "text-neutral-200"}`}>
              {m.content || <span className="text-dim">(no text)</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
