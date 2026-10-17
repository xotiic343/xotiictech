import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { EmptyState, PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";
import type { Doc } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Docs & FAQ", description: "Setup guides and answers for XotiicTech products and bots." };

export default async function DocsPage() {
  const data = await apiGet<{ sections: Record<string, Doc[]>; faq: Doc[] }>("/docs");
  const sections = Object.entries(data?.sections ?? {});
  return (
    <>
      <PageHeader eyebrow="manual" title="Docs & FAQ" subtitle="Setup guides for every product and bot, plus quick answers." />
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="h-display mb-5 text-xl">Guides</h2>
          {sections.length ? (
            <div className="space-y-8">
              {sections.map(([section, docs]) => (
                <div key={section}>
                  <div className="eyebrow mb-3">// {section}</div>
                  <ul className="divide-y divide-line border border-line bg-ink/80">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <Link href={`/docs/${d.slug}`} className="aberrate flex items-center justify-between px-4 py-3 text-sm text-neutral-300 hover:bg-panel hover:text-white">
                          {d.title}
                          <span className="text-blood">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No guides yet" />
          )}
        </section>
        <section>
          <h2 className="h-display mb-5 text-xl">FAQ</h2>
          <div className="space-y-2">
            {(data?.faq ?? []).map((q) => (
              <details key={q.id} className="card group p-0 open:border-crimson/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-white">
                  {q.title}
                  <span className="text-blood transition group-open:rotate-45">+</span>
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <Markdown>{q.body ?? ""}</Markdown>
                </div>
              </details>
            ))}
            {!data?.faq.length && <p className="text-sm text-muted">No questions yet.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
