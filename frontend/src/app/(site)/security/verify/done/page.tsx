import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Verification", robots: { index: false } };

const MESSAGES: Record<string, { title: string; body: string; tone: string }> = {
  ok: { title: "You're verified", body: "Your role has been given. You can go back to Discord now.", tone: "text-ok" },
  pending: {
    title: "Almost done",
    body: "Your verification is saved. The bot will give you your role within a minute. If it doesn't, press Verify in Discord again.",
    tone: "text-amber",
  },
  cancelled: { title: "Verification cancelled", body: "Nothing was saved. You can verify any time from the Discord server.", tone: "text-muted" },
  error: { title: "Verification failed", body: "Something went wrong. Please try again from the Verify button in Discord.", tone: "text-blood" },
};

export default async function VerifyDonePage({ searchParams }: { searchParams: Promise<{ s?: string; m?: string; g?: string }> }) {
  const { s, m, g } = await searchParams;
  const msg = MESSAGES[s ?? "error"] ?? MESSAGES.error;
  return (
    <div className="container-x py-24">
      <div className="card corner-brackets mx-auto max-w-md p-8 text-center">
        <div className="eyebrow">// security x</div>
        <h1 className={`h-display mt-3 text-2xl ${msg.tone}`}>{msg.title}</h1>
        <p className="mt-3 text-sm text-muted">{msg.body}</p>
        {m && <p className="mt-4 border border-line bg-black/60 p-3 text-xs text-neutral-300">{m.slice(0, 200)}</p>}
        <div className="mt-8 flex justify-center gap-2">
          <a href="https://discord.com/app" className="btn-primary btn-sm">
            Open Discord
          </a>
          {s !== "ok" && g && (
            <Link href={`/security/verify?g=${g}`} className="btn-ghost btn-sm">
              Try again
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
