"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { postJson } from "./postJson";

// Reply box for the ticket opener. The server relays the message into the Discord channel via the bot.
export function ReplyBox({ ticketId, disabled, disabledReason }: { ticketId: string; disabled: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    const content = text.trim();
    if (!content) {
      toast.error("Write a message first.");
      return;
    }
    startTransition(async () => {
      try {
        await postJson(`/support/api/tickets/${ticketId}/reply`, { content });
        setText("");
        toast.success("Message sent");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Message not sent.");
      }
    });
  }

  if (disabled) return <p className="border border-edge bg-black/60 p-4 text-sm text-muted">{disabledReason}</p>;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="reply" className="label">
        Reply
      </label>
      <textarea
        id="reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
        }}
        rows={3}
        maxLength={1800}
        className="input resize-y"
        placeholder="Write a reply. Ctrl+Enter to send."
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-dim">{text.length}/1800</span>
        <button type="submit" disabled={pending || !text.trim()} className="btn-primary btn-sm">
          {pending ? "Sending..." : "Send reply"}
        </button>
      </div>
    </form>
  );
}
