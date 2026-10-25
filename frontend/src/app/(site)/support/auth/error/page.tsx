import Link from "next/link";
import type { Metadata } from "next";
import { lastAuthError } from "@/lib/support/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Login problem", robots: { index: false } };

// Auth.js sends failed logins here as ?error=<code>. The full reason is in the web service's logs
// on a line starting with [auth][error].
const MESSAGES: Record<string, string> = {
  Configuration:
    "Login isn't set up correctly on the server. Check AUTH_SECRET, DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET, and that the Discord redirect URL matches this site.",
  AccessDenied: "Discord login was cancelled or not allowed.",
  Verification: "The login link expired or was already used. Please try again.",
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const code = typeof error === "string" ? error.slice(0, 40) : "Default";
  const detail = lastAuthError();

  return (
    <div className="container-x py-24">
      <div className="card corner-brackets mx-auto max-w-md p-8 text-center">
        <div className="eyebrow">// login failed</div>
        <h1 className="h-display mt-3 text-xl">We couldn&apos;t log you in</h1>
        <p className="mt-3 text-sm text-muted">{MESSAGES[code] ?? "Something went wrong while logging in with Discord. Please try again."}</p>
        <p className="tag mt-5">error: {code}</p>
        {detail && (
          <p className="mt-3 break-words border border-line bg-black/60 p-3 text-left text-[11px] text-muted">
            <span className="text-amber">details: </span>
            {detail}
          </p>
        )}
        <div className="mt-8">
          <Link href="/support" className="btn-ghost btn-sm">
            Back to support
          </Link>
        </div>
      </div>
    </div>
  );
}
