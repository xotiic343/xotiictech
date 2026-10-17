import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlitchText } from "@/components/fx/GlitchText";
import { Markdown } from "@/components/Markdown";
import { apiGet } from "@/lib/backend";
import { date } from "@/lib/format";
import type { Post } from "@/lib/types";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await apiGet<Post>(`/blog/${slug}`);
  return p
    ? { title: p.title, description: p.excerpt, openGraph: { type: "article", images: p.cover_image ? [p.cover_image] : undefined } }
    : { title: "Post not found" };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const p = await apiGet<Post>(`/blog/${slug}`);
  if (!p) notFound();
  return (
    <article className="container-x max-w-3xl pt-10">
      <Link href="/blog" className="text-[11px] uppercase tracking-[0.2em] text-dim hover:text-blood">
        ← blog
      </Link>
      <div className="mt-6 text-[11px] uppercase tracking-[0.2em] text-blood">
        {p.kind} · <span className="text-dim">{date(p.published_at)}</span>
      </div>
      <h1 className="h-display mt-3 text-3xl sm:text-5xl">
        <GlitchText text={p.title} />
      </h1>
      {p.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.cover_image} alt="" className="mt-8 w-full border border-line" />
      )}
      <div className="mt-8">
        <Markdown>{p.body ?? ""}</Markdown>
      </div>
      {p.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-1.5 border-t border-line pt-6">
          {p.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
