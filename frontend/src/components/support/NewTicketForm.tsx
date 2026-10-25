"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { postJson } from "./postJson";

type Category = { key: string; label: string; description: string | null };

// Client checks are only for quick feedback; the server validates everything again.
export function NewTicketForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [category, setCategory] = useState(categories[0]?.key ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = { category, subject: String(form.get("subject") ?? ""), description: String(form.get("description") ?? "") };

    const next: Record<string, string> = {};
    if (body.subject.trim().length < 3) next.subject = "Subject must be at least 3 characters.";
    if (body.description.trim().length < 10) next.description = "Describe the issue in at least 10 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;

    startTransition(async () => {
      try {
        const data = await postJson<{ id: string; number: number }>("/support/api/tickets", body);
        toast.success(`Ticket #${String(data.number).padStart(4, "0")} opened`);
        router.push(`/support/tickets/${data.id}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open the ticket.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card corner-brackets space-y-6 p-6 sm:p-8" noValidate>
      <fieldset>
        <legend className="label">Category</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.key}
              className={`flex cursor-pointer flex-col gap-1 border p-4 transition ${
                category === c.key ? "border-crimson bg-crimson/10 shadow-neon" : "border-edge hover:border-crimson/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="category" value={c.key} checked={category === c.key} onChange={() => setCategory(c.key)} className="accent-[#e60000]" />
                <span className="text-sm uppercase tracking-wider text-white">{c.label}</span>
              </span>
              {c.description && <span className="pl-6 text-xs text-muted">{c.description}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="subject" className="label">
          Subject
        </label>
        <input id="subject" name="subject" maxLength={100} className="input" placeholder="A short summary" aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "subject-err" : undefined} />
        {errors.subject && (
          <p id="subject-err" className="mt-1.5 text-xs text-blood">
            {errors.subject}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={7}
          maxLength={2000}
          className="input resize-y"
          placeholder="What happened, what you expected, and anything staff should know"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-err" : undefined}
        />
        <div className="mt-1.5 flex justify-between text-xs">
          {errors.description ? (
            <span id="description-err" className="text-blood">
              {errors.description}
            </span>
          ) : (
            <span />
          )}
          <span className="text-dim">max 2000 chars</span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">A private Discord channel is created for you. Only you and staff can see it.</p>
        <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
          {pending ? "Opening..." : "Open ticket"}
        </button>
      </div>
    </form>
  );
}
