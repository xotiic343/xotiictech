import { Markdown } from "@/components/Markdown";
import { PageHeader } from "@/components/ui";
import { apiGet } from "@/lib/backend";

export async function LegalPage({ page, title }: { page: "terms" | "privacy" | "refund_policy" | "licenses"; title: string }) {
  const data = await apiGet<{ body: string }>(`/legal/${page}`, 300);
  return (
    <>
      <PageHeader eyebrow="legal" title={title} />
      <div className="container-x max-w-3xl">
        <div className="card p-6 sm:p-10">
          {data?.body ? <Markdown>{data.body}</Markdown> : <p className="text-sm text-muted">This page hasn&apos;t been written yet.</p>}
        </div>
      </div>
    </>
  );
}
