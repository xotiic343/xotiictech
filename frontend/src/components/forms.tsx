"use client";

import { useState } from "react";
import { z } from "zod";
import { api, ApiError } from "@/lib/client";
import { commissionSchema, contactSchema, emailSchema, fieldErrors } from "@/lib/validation";

type Status = { kind: "idle" | "loading" | "ok" | "error"; message?: string };

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-blood">! {error}</span>}
    </label>
  );
}

export function FormStatus({ status }: { status: Status }) {
  if (status.kind === "ok") return <div className="border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok">✓ {status.message}</div>;
  if (status.kind === "error") return <div className="border border-blood/50 bg-blood/5 px-4 py-3 text-sm text-blood">! {status.message}</div>;
  return null;
}

/** Validates with zod, posts JSON, maps server field errors back onto inputs. */
function useForm<S extends z.ZodTypeAny>(schema: S, path: string, okMessage: string) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setStatus({ kind: "loading" });
    try {
      const data = Object.fromEntries(Object.entries(parsed.data as Record<string, unknown>).filter(([, v]) => v !== "" && v !== undefined));
      await api(path, { method: "POST", json: data });
      setStatus({ kind: "ok", message: okMessage });
      form.reset();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }
  return { errors, status, submit };
}

const Honeypot = () => (
  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden defaultValue="" />
);

export function NewsletterForm() {
  const { errors, status, submit } = useForm(emailSchema, "/newsletter", "You're on the list.");
  if (status.kind === "ok") return <FormStatus status={status} />;
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" noValidate>
      <div className="flex-1">
        <input name="email" type="email" placeholder="you@domain.com" className="input" aria-label="Email" />
        {errors.email && <span className="mt-1 block text-xs text-blood">! {errors.email}</span>}
      </div>
      <button className="btn-primary" disabled={status.kind === "loading"}>
        {status.kind === "loading" ? "Linking…" : "Subscribe"}
      </button>
      {status.kind === "error" && <FormStatus status={status} />}
    </form>
  );
}

export function ContactForm() {
  const { errors, status, submit } = useForm(contactSchema, "/contact", "Message received — I'll reply by email.");
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <input name="name" className="input" maxLength={120} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input name="email" type="email" className="input" />
        </Field>
      </div>
      <Field label="Subject" error={errors.subject}>
        <input name="subject" className="input" maxLength={200} />
      </Field>
      <Field label="Message" error={errors.message}>
        <textarea name="message" rows={6} className="input resize-y" maxLength={5000} />
      </Field>
      <FormStatus status={status} />
      <button className="btn-primary w-full sm:w-auto" disabled={status.kind === "loading"}>
        {status.kind === "loading" ? "Transmitting…" : "Send message"}
      </button>
    </form>
  );
}

export function CommissionForm({ referenceBot }: { referenceBot?: string }) {
  const { errors, status, submit } = useForm(
    commissionSchema,
    "/bots/inquiries",
    "Commission request received. Expect a reply within 48 hours.",
  );
  if (status.kind === "ok")
    return (
      <div className="card corner-brackets p-8 text-center">
        <div className="font-display text-2xl font-black uppercase text-ok">Request received</div>
        <p className="mt-3 text-sm text-muted">{status.message}</p>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Honeypot />
      {referenceBot && <input type="hidden" name="reference_bot" value={referenceBot} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Discord username" error={errors.discord_username}>
          <input name="discord_username" className="input" placeholder="yourname" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input name="email" type="email" className="input" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Server size" error={errors.server_size}>
          <select name="server_size" className="input" defaultValue="100-1k">
            {["<100", "100-1k", "1k-10k", "10k-100k", "100k+"].map((v) => (
              <option key={v} value={v}>
                {v} members
              </option>
            ))}
          </select>
        </Field>
        <Field label="Budget" error={errors.budget}>
          <select name="budget" className="input" defaultValue="$50-150">
            {["<$50", "$50-150", "$150-500", "$500-1500", "$1500+"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Timeline" error={errors.timeline}>
          <select name="timeline" className="input" defaultValue="flexible">
            {[
              ["asap", "ASAP"],
              ["1-2 weeks", "1–2 weeks"],
              ["1 month", "~1 month"],
              ["flexible", "Flexible"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="What is the bot for?" error={errors.purpose}>
        <textarea name="purpose" rows={3} className="input resize-y" placeholder="e.g. moderation + tickets for a 5k-member gaming community" />
      </Field>
      <Field label="Features you need" error={errors.features}>
        <textarea name="features" rows={6} className="input resize-y" placeholder={"- /ticket with transcripts\n- auto-mod with custom filters\n- dashboard"} />
      </Field>
      <FormStatus status={status} />
      <button className="btn-primary w-full sm:w-auto" disabled={status.kind === "loading"}>
        {status.kind === "loading" ? "Transmitting…" : "Send commission request"}
      </button>
    </form>
  );
}

export function BuyButton({ slug, disabled, label = "Buy now" }: { slug: string; disabled?: boolean; label?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function buy() {
    if (email && !emailSchema.safeParse({ email }).success) {
      setStatus({ kind: "error", message: "Enter a valid email (or leave blank to enter it at checkout)" });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const { url } = await api<{ url: string }>("/checkout/session", {
        method: "POST",
        json: { product_slug: slug, ...(email ? { email } : {}) },
      });
      window.location.assign(url);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Checkout failed" });
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Delivery email (optional)"
        className="input"
        aria-label="Delivery email"
      />
      <button onClick={buy} disabled={disabled || status.kind === "loading"} className="btn-primary w-full py-3.5 text-base">
        {status.kind === "loading" ? "Opening secure checkout…" : label}
      </button>
      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-dim">Secure checkout by Stripe · Instant delivery</p>
      <FormStatus status={status} />
    </div>
  );
}

export function ReviewForm({ slug }: { slug: string }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 5) return setStatus({ kind: "error", message: "Write at least a few words" });
    setStatus({ kind: "loading" });
    try {
      const res = await api<{ pending_approval: boolean }>(`/bots/${slug}/reviews`, { method: "POST", json: { rating, body } });
      setStatus({ kind: "ok", message: res.pending_approval ? "Thanks! Your review will appear after approval." : "Thanks for the review!" });
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 401
          ? "Sign in to your account to review (buyers only)."
          : err instanceof Error
            ? err.message
            : "Failed";
      setStatus({ kind: "error", message: msg });
    }
  }

  if (status.kind === "ok") return <FormStatus status={status} />;
  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="label">Leave a review (buyers only)</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-amber" : "text-dim"}`} aria-label={`${n} stars`}>
            ★
          </button>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} className="input" placeholder="How has the bot worked for you?" />
      <FormStatus status={status} />
      <button className="btn-ghost btn-sm" disabled={status.kind === "loading"}>
        Submit review
      </button>
    </form>
  );
}
