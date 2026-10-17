"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/store", label: "Store" },
  { href: "/bots", label: "Bots" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/tools", label: "Free Tools", hot: true },
  { href: "/blog", label: "Blog" },
  { href: "/docs", label: "Docs" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled ? "border-crimson/40 bg-black/85 backdrop-blur-md" : "border-transparent bg-transparent"
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2" aria-label="XotiicTech home">
          <span className="grid h-8 w-8 place-items-center border border-crimson bg-crimson/10 font-display text-sm font-black text-blood shadow-neon">
            X
          </span>
          <span className="aberrate font-display text-lg font-black tracking-[0.2em] text-white">
            XOTIIC<span className="text-blood">TECH</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`aberrate relative px-3 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
                  active(l.href) ? "text-blood" : l.hot ? "text-amber hover:text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                {l.label}
                {active(l.href) && (
                  <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-px bg-blood shadow-neon" />
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/account" className="btn-ghost btn-sm">
            Account
          </Link>
          <Link href="/bots/commission" className="btn-primary btn-sm">
            Commission
          </Link>
        </div>

        <button
          className="grid h-10 w-10 place-items-center border border-edge text-blood lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span className="font-display text-lg">{open ? "×" : "≡"}</span>
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-crimson/30 bg-black/95 lg:hidden"
          >
            <ul className="container-x flex flex-col py-3">
              {[...LINKS, { href: "/account", label: "Account" }, { href: "/bots/commission", label: "Commission a bot" }].map(
                (l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={`block border-b border-line py-3 text-sm uppercase tracking-[0.2em] ${
                        active(l.href) ? "text-blood" : "text-neutral-300"
                      }`}
                    >
                      <span className="text-crimson">&gt; </span>
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
