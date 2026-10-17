import type { FreeTool } from "@/lib/types";

/** Big call-out for the free tools (e.g. the R6 Siege PC checker). Content is editable in /xotiic → Content. */
export function FreeToolsBanner({ tool }: { tool: FreeTool }) {
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden border border-amber/50 bg-gradient-to-r from-amber/[0.08] via-black to-crimson/[0.08] p-6 transition hover:border-amber hover:shadow-[0_0_32px_rgba(255,176,0,.25)] sm:p-8"
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber/10 blur-3xl transition group-hover:bg-amber/20" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="animate-pulse-dot border border-amber bg-amber px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-black">
              {tool.badge || "FREE"}
            </span>
            <span className="text-[11px] uppercase tracking-[0.3em] text-amber">// free tool</span>
          </div>
          <div className="aberrate font-display text-xl font-black uppercase tracking-wide text-white sm:text-2xl">{tool.name}</div>
          {tool.description && <p className="mt-2 max-w-2xl text-sm text-neutral-400">{tool.description}</p>}
        </div>
        <span className="btn shrink-0 border border-amber bg-amber text-black transition group-hover:bg-white">
          Scan my PC free <span className="transition group-hover:translate-x-1">→</span>
        </span>
      </div>
    </a>
  );
}

export function FreeToolCard({ tool }: { tool: FreeTool }) {
  return (
    <a href={tool.url} target="_blank" rel="noopener noreferrer" className="card card-hover group flex h-full flex-col p-6">
      <span className="mb-3 w-fit border border-amber/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-amber">
        {tool.badge || "FREE"}
      </span>
      <div className="aberrate-child font-display text-lg font-bold uppercase tracking-wide text-white">{tool.name}</div>
      {tool.description && <p className="mt-2 flex-1 text-sm text-muted">{tool.description}</p>}
      <span className="mt-5 text-xs uppercase tracking-[0.2em] text-amber transition group-hover:translate-x-1">
        Open tool ↗
      </span>
    </a>
  );
}
