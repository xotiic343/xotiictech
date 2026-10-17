import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlitchText } from "@/components/fx/GlitchText";
import { Markdown } from "@/components/Markdown";
import { apiGet } from "@/lib/backend";
import type { Doc } from "@/lib/types";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await apiGet<Doc>(`/docs/${slug}`);
  return { title: d ? d.title : "Doc not found" };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const d = await apiGet<Doc>(`/docs/${slug}`);
  if (!d) notFound();
  return (
    <article className="container-x max-w-3xl pt-10">
      <Link href="/docs" className="text-[11px] uppercase tracking-[0.2em] text-dim hover:text-blood">
        ← docs
      </Link>
      <div className="eyebrow mt-6">// {d.section}</div>
      <h1 className="h-display mt-2 text-3xl sm:text-4xl">
        <GlitchText text={d.title} />
      </h1>
      <div className="mt-8">
        <Markdown>{d.body ?? ""}</Markdown>
      </div>
    </article>
  );
}
