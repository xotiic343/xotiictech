// /support shell: sits inside the main site layout (navbar, footer, CRT effects) and adds the support
// sub-tabs, the Discord login bar and toasts. The staff panel is deliberately not linked here.
import type { Metadata } from "next";
import { Toaster } from "sonner";
import { signIn, signOut } from "@/lib/support/auth";
import { getCurrentUser, type CurrentUser } from "@/lib/support/session";
import { missingSupportEnv } from "@/lib/support/env";
import { isStaffUser } from "@/lib/support/staff";
import { SupportTabs } from "@/components/support/SupportTabs";

export const metadata: Metadata = { title: { default: "Support", template: "%s // Support // XotiicTech" } };
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/support", label: "Overview" },
  { href: "/support/tickets", label: "My tickets" },
  { href: "/support/tickets/new", label: "Open ticket" },
];

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  // Missing support env vars: show which ones (names only) instead of taking the whole section down.
  const missing = missingSupportEnv();
  let user: CurrentUser | null = null;
  let staff = false;
  let configured = missing.length === 0;
  if (configured) {
    try {
      user = await getCurrentUser();
      // Staff = holds STAFF_ROLE_ID in the support server, checked live against Discord (cached 60s).
      staff = user ? await isStaffUser(user.discordId) : false;
    } catch (err) {
      console.error(err);
      configured = false;
    }
  }
  // The staff tab only exists for staff, so nobody else learns the panel is there.
  const tabs = staff ? [...TABS, { href: "/support/exotic", label: "Staff panel" }] : TABS;

  return (
    <>
      <div className="border-b border-line bg-black/70 backdrop-blur-sm">
        <div className="container-x flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
          <SupportTabs tabs={tabs} />
          {configured && (
            <div className="flex items-center gap-3 pb-2 sm:pb-0">
              {user ? (
                <>
                  <span className="text-[11px] uppercase tracking-wider text-muted">
                    <span className="text-crimson">&gt; </span>
                    {user.globalName || user.username}
                    {staff && <span className="ml-2 border border-cyan/50 px-1.5 text-[10px] text-cyan">staff</span>}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/support" });
                    }}
                  >
                    <button type="submit" className="btn-ghost btn-sm">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("discord", { redirectTo: "/support/tickets" });
                  }}
                >
                  <button type="submit" className="btn-primary btn-sm">
                    Login with Discord
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {configured ? (
        children
      ) : (
        <div className="container-x py-20">
          <div className="card corner-brackets mx-auto max-w-lg p-8 text-center">
            <div className="eyebrow">// offline</div>
            <h1 className="h-display mt-3 text-xl">Support is being set up</h1>
            <p className="mt-3 text-sm text-muted">The ticket system isn&apos;t configured on this server yet. Please check back soon.</p>
            {missing.length > 0 && (
              <div className="mt-5 border border-amber/40 bg-amber/5 p-4 text-left">
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber">missing on the web service</div>
                <ul className="mt-2 space-y-1 text-xs text-neutral-300">
                  {missing.map((name) => (
                    <li key={name}>
                      <span className="text-crimson">&gt; </span>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: { background: "#000", border: "1px solid rgba(230,0,0,.6)", borderRadius: 0, color: "#e5e5e5", fontFamily: "var(--font-mono)" },
        }}
      />
    </>
  );
}
