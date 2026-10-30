"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/kit";
import { api } from "@/lib/client";

const NAV: [string, string][] = [
  ["/xotiic", "Dashboard"],
  ["/xotiic/bots", "Bots"],
  ["/xotiic/security", "Security X"],
  ["/xotiic/vendingx", "Vending X"],
  ["/xotiic/inquiries", "Commissions"],
  ["/xotiic/orders", "Orders"],
  ["/xotiic/products", "Products"],
  ["/xotiic/blog", "Blog"],
  ["/xotiic/docs", "Docs / FAQ"],
  ["/xotiic/testimonials", "Testimonials"],
  ["/xotiic/content", "Site content"],
  ["/xotiic/messages", "Messages"],
  ["/xotiic/users", "Users & subs"],
  ["/xotiic/analytics", "Analytics"],
  ["/xotiic/settings", "Settings"],
  ["/xotiic/audit", "Audit log"],
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useAdmin<{ username: string }>("/auth/me");
  const [open, setOpen] = useState(false);

  async function logout() {
    try {
      await api("/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/xotiic/login");
    }
  }

  const isActive = (href: string) => (href === "/xotiic" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-black lg:grid lg:grid-cols-[230px_1fr]">
      <aside className={`${open ? "block" : "hidden"} border-b border-crimson/30 bg-ink lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r`}>
        <div className="hidden px-5 py-5 lg:block">
          <div className="font-display text-base font-black tracking-[0.2em] text-white">
            XOTIIC<span className="text-blood">CTRL</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-dim">{me ? `● ${me.username}` : "…"}</div>
        </div>
        <nav className="px-2 pb-4">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block border-l-2 px-3 py-2 text-xs uppercase tracking-[0.15em] transition ${
                isActive(href) ? "border-blood bg-crimson/10 text-blood" : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="mt-4 space-y-1 border-t border-line px-3 pt-4 text-xs">
            <a href="/" target="_blank" className="block text-muted hover:text-white">
              View site ↗
            </a>
            <button onClick={logout} className="text-blood hover:text-white">
              Log out
            </button>
          </div>
        </nav>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <span className="font-display font-black tracking-[0.2em] text-white">
            XOTIIC<span className="text-blood">CTRL</span>
          </span>
          <button onClick={() => setOpen((o) => !o)} className="border border-edge px-3 py-1 text-blood" aria-label="Menu">
            ≡
          </button>
        </div>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
