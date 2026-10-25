"use client";

// Sub-navigation under the main navbar, shown on every /support page.
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SupportTab = { href: string; label: string };

export function SupportTabs({ tabs }: { tabs: SupportTab[] }) {
  const pathname = usePathname();
  // Exact match for section roots, prefix match for deeper pages (e.g. /support/tickets/abc).
  const active = (href: string) =>
    href === "/support" || href === "/support/exotic" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ul className="flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            aria-current={active(t.href) ? "page" : undefined}
            className={`aberrate block whitespace-nowrap border-b-2 px-3 py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
              active(t.href) ? "border-blood text-blood" : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
