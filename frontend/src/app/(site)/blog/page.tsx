import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/fx/Reveal";
import { EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import { date } from "@/lib/format";
import type { Post } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Blog", description: "Announcements, tutorials and changelogs from XotiicTech." };

const KIND_COLOR: Record<string, string> = { announcement: "text-blood", tutorial: "text-cyan", changelog: "text-amber" };

export default async function BlogPage() {
  const data = await apiGet<{ items: Post[] }>("/blog");
  const posts = data?.items ?? [];
  return (
    <>
      <PageHeader eyebrow="transmissions" title="Blog" subtitle="Announcements, tutorials and release notes." />
      <div className="container-x">
        {posts.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.04}>
                <Link href={`/blog/${p.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
                  {p.cover_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_image} alt="" className="aspect-[2/1] w-full border-b border-line object-cover opacity-80 group-hover:opacity-100" />
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em]">
                      <span className={KIND_COLOR[p.kind]}>{p.kind}</span>
                      <span className="text-dim">{date(p.published_at)}</span>
                    </div>
                    <h2 className="aberrate-child mt-3 font-display text-xl font-bold uppercase text-white">{p.title}</h2>
                    <p className="mt-2 flex-1 text-sm text-muted">{p.excerpt}</p>
                    <span className="mt-4 text-xs uppercase tracking-[0.2em] text-blood">Read →</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState title="No posts yet" />
        )}
      </div>
    </>
  );
}
