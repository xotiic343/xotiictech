"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

export default function VerifyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // tokens are single-use; guard against StrictMode double-run
    ran.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }
    // Remove the token from the address bar/history right away.
    window.history.replaceState(null, "", "/account/verify");
    api("/auth/magic-link/verify", { method: "POST", json: { token } })
      .then(() => router.replace("/account"))
      .catch((e) => setError(e instanceof Error ? e.message : "Sign-in failed"));
  }, [router]);

  return (
    <div className="container-x flex min-h-[60vh] items-center justify-center">
      <div className="card corner-brackets max-w-md p-8 text-center">
        {error ? (
          <>
            <div className="font-display text-xl font-bold uppercase text-blood">Link rejected</div>
            <p className="mt-3 text-sm text-muted">{error}</p>
            <a href="/account" className="btn-ghost mt-6">
              Request a new link
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin border-2 border-crimson border-t-transparent" />
            <div className="mt-5 font-display uppercase tracking-wider text-white">Authenticating…</div>
          </>
        )}
      </div>
    </div>
  );
}
