"use client";

// Staff controls for one ticket. Every action is re-checked on the server (staff role + CSRF).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { postJson } from "./postJson";

type Props = { ticketId: string; state: string; priority: string; claimedById: string | null; assigneeId: string | null; viewerId: string };

export function StaffActions({ ticketId, state, priority, claimedById, assigneeId, viewerId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assignee, setAssignee] = useState(assigneeId ?? "");
  const [reason, setReason] = useState("");
  const [reply, setReply] = useState("");
  const closed = state === "closed";

  function run(body: Record<string, unknown>, success: string) {
    startTransition(async () => {
      try {
        await postJson(`/support/api/staff/tickets/${ticketId}/action`, body);
        toast.success(success);
        if (body.action === "reply") setReply("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed. Nothing was changed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="eyebrow">
          // actions
        </h2>

        <div className="flex flex-wrap gap-2">
          {claimedById === viewerId ? (
            <button className="btn-ghost btn-sm" disabled={pending || closed} onClick={() => run({ action: "unclaim" }, "Ticket released")}>
              Release
            </button>
          ) : (
            <button className="btn-ghost btn-sm" disabled={pending || closed} onClick={() => run({ action: "claim" }, "Ticket claimed")}>
              Claim
            </button>
          )}
          {closed ? (
            <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run({ action: "reopen" }, "Ticket reopened")}>
              Reopen
            </button>
          ) : (
            <button
              className="btn-primary btn-sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Close this ticket? The user is notified and the channel is archived.")) {
                  run({ action: "close", reason: reason.trim() || undefined }, "Ticket closed");
                }
              }}
            >
              Close
            </button>
          )}
        </div>

        {!closed && (
          <div>
            <label htmlFor="close-reason" className="label">
              Close reason (optional)
            </label>
            <input id="close-reason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}

        <div>
          <label htmlFor="priority" className="label">
            Priority
          </label>
          <select id="priority" className="input" value={priority} disabled={pending} onChange={(e) => run({ action: "priority", priority: e.target.value }, "Priority updated")}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label htmlFor="assignee" className="label">
            Assign to (Discord user ID)
          </label>
          <div className="flex gap-2">
            <input id="assignee" inputMode="numeric" className="input" placeholder="123456789012345678" value={assignee} onChange={(e) => setAssignee(e.target.value.trim())} />
            <button
              className="btn-ghost btn-sm shrink-0"
              disabled={pending || closed}
              onClick={() => run({ action: "assign", assigneeId: assignee || null }, assignee ? "Ticket assigned" : "Assignment cleared")}
            >
              Save
            </button>
          </div>
          {assigneeId && <p className="mt-1.5 text-xs text-dim">Currently assigned to {assigneeId}</p>}
        </div>
      </section>

      <section className="card space-y-3 p-5" aria-labelledby="reply-heading">
        <h2 id="reply-heading" className="eyebrow">
          // reply to user
        </h2>
        <p className="text-xs text-muted">Posted in the Discord ticket channel under your name. Use internal notes for anything the user shouldn't see.</p>
        <textarea
          aria-label="Staff reply"
          className="input resize-y"
          rows={4}
          maxLength={1800}
          value={reply}
          disabled={closed}
          onChange={(e) => setReply(e.target.value)}
          placeholder={closed ? "Reopen the ticket to reply." : "Write a reply"}
        />
        <div className="flex justify-end">
          <button className="btn-primary btn-sm" disabled={pending || closed || !reply.trim()} onClick={() => run({ action: "reply", content: reply.trim() }, "Reply sent")}>
            Send reply
          </button>
        </div>
      </section>
    </div>
  );
}
