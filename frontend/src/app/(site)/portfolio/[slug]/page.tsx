import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlitchText } from "@/components/fx/GlitchText";
import { Markdown } from "@/components/Markdown";
import { MediaGallery } from "@/components/MediaGallery";
import { apiGet } from "@/lib/backend";
import type { Media, Project } from "@/lib/types";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await apiGet<Project>(`/portfolio/${slug}`);
  return p ? { title: p.title, description: p.summary } : { title: "Project not found" };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = await apiGet<Project>(`/portfolio/${slug}`);
  if (!p) notFound();
  const media: Media[] = [...(p.cover_image ? [{ type: "image" as const, url: p.cover_image }] : []), ...p.media];

  return (
    <div className="container-x pt-10">
      <Link href="/portfolio" className="text-[11px] uppercase tracking-[0.2em] text-dim hover:text-blood">
        ← portfolio
      </Link>
      <header className="mt-6 max-w-3xl">
        {p.category && <div className="eyebrow mb-2">// {p.category}</div>}
        <h1 className="h-display text-3xl sm:text-5xl">
          <GlitchText text={p.title} />
        </h1>
        <p className="mt-4 text-neutral-400">{p.summary}</p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {p.stack.map((s) => (
            <span key={s} className="tag">
              {s}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {p.live_url && (
            <a href={p.live_url} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Live site ↗
            </a>
          )}
          {p.repo_url && (
            <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Source ↗
            </a>
          )}
        </div>
      </header>
      {media.length > 0 && (
        <div className="mt-10">
          <MediaGallery media={media} />
        </div>
      )}
      {p.body && (
        <div className="mt-10 max-w-3xl">
          <Markdown>{p.body}</Markdown>
        </div>
      )}
    </div>
  );
}
