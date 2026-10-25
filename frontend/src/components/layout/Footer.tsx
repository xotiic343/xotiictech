import Link from "next/link";
import type { SiteData } from "@/lib/types";

const SOCIAL_LABELS: Record<string, string> = {
  discord: "Discord",
  github: "GitHub",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

export function Footer({ site }: { site: SiteData | null }) {
  const socials = Object.entries(site?.socials ?? {}).filter(([, url]) => !!url);
  const tools = site?.free_tools?.enabled ? site.free_tools.items : [];
  return (
    <footer className="relative mt-24 border-t border-crimson/30 bg-black">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blood to-transparent" />
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="font-display text-xl font-black tracking-[0.2em] text-white">
            XOTIIC<span className="text-blood">TECH</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted">{site?.footer?.blurb}</p>
          {socials.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map(([k, url]) => (
                <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="tag hover:border-crimson hover:text-blood">
                  {SOCIAL_LABELS[k] ?? k}
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol
          title="Platform"
          links={[
            ["/store", "Store"],
            ["/bots", "Discord Bots"],
            ["/bots/commission", "Commission a bot"],
            ["/account", "My purchases"],
            ["/support", "Support tickets"],
          ]}
        />
        <FooterCol
          title="Resources"
          links={[
            ["/tools", "Free Tools"],
            ["/docs", "Docs & FAQ"],
            ["/blog", "Blog"],
            ["/changelog", "Changelog"],
            ["/status", "Status"],
            ["/about", "About"],
            ["/contact", "Contact"],
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            ["/terms", "Terms"],
            ["/privacy", "Privacy"],
            ["/refund-policy", "Refund policy"],
            ["/licenses", "Licenses"],
          ]}
        />
      </div>
      {tools.length > 0 && (
        <div className="container-x pb-6">
          <a
            href={tools[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 border border-amber/40 bg-amber/5 px-4 py-3 text-xs text-amber transition hover:border-amber hover:bg-amber/10"
          >
            <span>
              <span className="mr-2 font-bold">[{tools[0].badge || "FREE"}]</span>
              {tools[0].name}
            </span>
            <span className="transition group-hover:translate-x-1">→</span>
          </a>
        </div>
      )}
      <div className="border-t border-line">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-[11px] uppercase tracking-[0.2em] text-dim sm:flex-row">
          <span>© {new Date().getFullYear()} XotiicTech. All rights reserved.</span>
          <span>
            <span className="text-crimson">■</span> built by XotiicTech
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="aberrate text-neutral-400 hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
