import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import { date } from "@/lib/format";
import type { Post } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Changelog" };

export default async function ChangelogPage() {
  const data = await apiGet<{ items: Post[] }>("/blog?kind=changelog");
  const entries = data?.items ?? [];
  return (
    <>
      <PageHeader eyebrow="release log" title="Changelog" subtitle="Everything shipped, newest first." />
      <div className="container-x max-w-3xl">
        {entries.length ? (
          <ol className="relative space-y-10 border-l border-crimson/40 pl-8">
            {entries.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[37px] top-1.5 h-3 w-3 rotate-45 border border-blood bg-black shadow-neon" />
                <div className="text-[11px] uppercase tracking-[0.2em] text-dim">{date(e.published_at)}</div>
                <h2 className="mt-1 font-display text-xl font-bold uppercase text-white">{e.title}</h2>
                <div className="mt-3">
                  <Markdown>{e.body ?? e.excerpt}</Markdown>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No releases logged yet" />
        )}
      </div>
    </>
  );
}
