"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { dateTime } from "@/lib/format";

type Result = {
  status: string;
  product_name: string;
  product_slug: string | null;
  email: string;
  is_hosted: boolean;
  download_url: string | null;
  download_expires_at: string | null;
};

export default function SuccessPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session_id");
    if (!sid) {
      setError("Missing checkout session.");
      return;
    }
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await api<Result>(`/checkout/session/${encodeURIComponent(sid)}`);
        setResult(r);
        if (r.status === "pending" && tries++ < 10) timer = setTimeout(poll, 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your order.");
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-16">
      <div className="card corner-brackets w-full max-w-xl p-8 text-center shadow-neon sm:p-10">
        {error ? (
          <>
            <div className="font-display text-2xl font-black uppercase text-blood">Something went sideways</div>
            <p className="mt-3 text-sm text-muted">{error}</p>
          </>
        ) : !result || result.status === "pending" ? (
          <>
            <div className="mx-auto h-10 w-10 animate-spin border-2 border-crimson border-t-transparent" />
            <div className="mt-6 font-display text-xl font-bold uppercase text-white">Confirming payment…</div>
            <p className="mt-2 text-sm text-muted">This usually takes a few seconds.</p>
          </>
        ) : result.status === "paid" ? (
          <>
            <div className="eyebrow">// transaction complete</div>
            <div className="mt-3 font-display text-3xl font-black uppercase text-ok">Payment received</div>
            <p className="mt-3 text-sm text-neutral-300">
              <span className="text-white">{result.product_name}</span> is yours. A copy of the download link was sent to{" "}
              <span className="text-blood">{result.email}</span>.
            </p>
            {result.download_url && (
              <>
                <a href={result.download_url} className="btn-primary mt-8 w-full py-4 text-base">
                  ⬇ Download now
                </a>
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-dim">
                  Link expires {dateTime(result.download_expires_at)}
                </p>
              </>
            )}
            {result.is_hosted && (
              <p className="mt-6 border border-amber/40 bg-amber/5 p-4 text-sm text-amber">
                Hosted bot: sign in to your account and submit your Discord server ID to start deployment.
              </p>
            )}
            <Link href="/account" className="btn-ghost mt-6 w-full">
              Go to my purchases
            </Link>
          </>
        ) : (
          <>
            <div className="font-display text-2xl font-black uppercase text-amber">Payment {result.status}</div>
            <p className="mt-3 text-sm text-muted">No charge was completed. You can try again from the store.</p>
            <Link href="/store" className="btn-ghost mt-6">
              Back to store
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
