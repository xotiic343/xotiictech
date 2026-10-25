import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";

export const metadata: Metadata = { title: "Verify", robots: { index: false } };
export const dynamic = "force-dynamic";

type Info = { guild: { id: string; name: string; icon: string | null; members: number }; ready: boolean };

// Consent page for Security X verification. Signing in here grants the `guilds.join` permission, which is
// what lets the server owner add you to their backup server later. That is stated plainly before you
// continue, and you can withdraw it at any time.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams;
  const info = g && /^\d{5,25}$/.test(g) ? await apiGet<Info>(`/security/verify/info?g=${g}`, 0) : null;

  if (!info) {
    return (
      <div className="container-x py-20">
        <EmptyState title="Unknown server">This verification link is not valid. Use the Verify button in the Discord server again.</EmptyState>
      </div>
    );
  }

  const { guild, ready } = info;
  return (
    <>
      <PageHeader eyebrow="security x" title="Verify" subtitle={`Get access to ${guild.name}.`} />
      <div className="container-x max-w-2xl">
        <div className="card corner-brackets space-y-6 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            {guild.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={guild.icon} alt="" className="h-14 w-14 border border-edge" />
            ) : (
              <div className="grid h-14 w-14 place-items-center border border-edge font-display text-lg text-blood">{guild.name.slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <div className="font-display text-lg font-bold uppercase tracking-wider text-white">{guild.name}</div>
              <div className="text-[11px] uppercase tracking-wider text-dim">{guild.members.toLocaleString("en")} members</div>
            </div>
          </div>

          <div className="space-y-3 border border-line bg-black/60 p-4 text-sm leading-relaxed text-neutral-300">
            <div className="eyebrow">// what you agree to</div>
            <p>
              <span className="text-crimson">&gt; </span>You sign in with Discord so Security X can confirm who you are. We get your username and avatar, never your
              password or messages.
            </p>
            <p>
              <span className="text-crimson">&gt; </span>
              <strong className="text-white">You allow Security X to add you to {guild.name}&apos;s backup server</strong> if this server is ever deleted,
              raided or replaced. Discord shows this as <em>&quot;Join servers for you&quot;</em>.
            </p>
            <p>
              <span className="text-crimson">&gt; </span>It is only used to add you to this community&apos;s backup server, never to post as you. You can withdraw it at
              any time in Discord: User Settings, then Authorized Apps, then remove Security X.
            </p>
          </div>

          {ready ? (
            <a href={`/api/security/oauth/start?g=${guild.id}`} className="btn-primary w-full">
              I agree, verify with Discord
            </a>
          ) : (
            <p className="border border-amber/40 bg-amber/5 p-3 text-xs text-amber">Verification isn&apos;t set up for this server yet. Ask the server staff.</p>
          )}
          <p className="text-center text-xs text-dim">
            Don&apos;t want to agree? Close this page. See our <Link href="/privacy" className="text-blood hover:text-white">privacy policy</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
