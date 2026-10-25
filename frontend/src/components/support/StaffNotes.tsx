"use client";

// Internal staff notes. Stored on the website only, never sent to Discord.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { postJson } from "./postJson";

export type NoteItem = { id: string; authorName: string; body: string; createdAt: string };

export function StaffNotes({ ticketId, notes }: { ticketId: string; notes: NoteItem[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      try {
        await postJson(`/support/api/staff/tickets/${ticketId}/notes`, { body: body.trim() });
        setBody("");
        toast.success("Note saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Note not saved.");
      }
    });
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="notes-heading">
      <div>
        <h2 id="notes-heading" className="eyebrow">
          // internal notes
        </h2>
        <p className="mt-1 text-xs text-muted">Staff only. Never sent to Discord.</p>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-dim">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border border-amber/30 bg-amber/5 p-3">
              <p className="whitespace-pre-wrap text-sm text-neutral-200">{n.body}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-dim">
                {n.authorName} · {new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" }).format(new Date(n.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add();
        }}
      >
        <label htmlFor="note" className="sr-only">
          New internal note
        </label>
        <textarea id="note" className="input resize-y" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note" />
        <div className="flex justify-end">
          <button type="submit" className="btn-ghost btn-sm" disabled={pending || !body.trim()}>
            {pending ? "Saving..." : "Add note"}
          </button>
        </div>
      </form>
    </section>
  );
}
