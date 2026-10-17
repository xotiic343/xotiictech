import Link from "next/link";
import { GlitchText } from "@/components/fx/GlitchText";

export function PageHeader({ eyebrow, title, subtitle, children }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="container-x pb-10 pt-14 sm:pt-20">
      {eyebrow && <div className="eyebrow mb-3">// {eyebrow}</div>}
      <h1 className="h-display text-3xl sm:text-5xl">
        <GlitchText text={title} />
      </h1>
      {subtitle && <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">{subtitle}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function SectionHeading({ eyebrow, title, href, linkLabel = "View all" }: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <div className="eyebrow mb-2">// {eyebrow}</div>
        <h2 className="h-display text-2xl sm:text-3xl">
          <GlitchText text={title} />
        </h2>
      </div>
      {href && (
        <Link href={href} className="aberrate shrink-0 text-xs uppercase tracking-[0.2em] text-blood hover:text-white">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

export function StatusDot({ status, label = true }: { status: string; label?: boolean }) {
  const online = status === "online";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
      <span
        className={`h-2 w-2 rounded-full ${online ? "animate-pulse-dot bg-ok shadow-[0_0_8px_#22ff88]" : "bg-dim"}`}
        aria-hidden
      />
      {label && <span className={online ? "text-ok" : "text-dim"}>{online ? "online" : "offline"}</span>}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card corner-brackets px-6 py-16 text-center">
      <div className="font-display text-lg uppercase tracking-widest text-white">{title}</div>
      {children && <div className="mt-3 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber" aria-label={`${rating} out of 5`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-dim">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}
