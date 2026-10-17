"use client";

import { Badge } from "@/components/admin/kit";
import { PublishedBadge, ResourceManager } from "@/components/admin/ResourceManager";

export default function PortfolioAdmin() {
  return (
    <ResourceManager
      title="Portfolio"
      path="portfolio"
      publicHref={(r) => `/portfolio/${r.slug}`}
      defaults={{
        title: "", slug: "", summary: "", body: "", category: "", stack: [], cover_image: "", media: [],
        live_url: "", repo_url: "", is_featured: false, is_published: false, sort_order: 0,
      }}
      columns={[
        { key: "title", label: "Title", render: (r) => <span className="text-white">{String(r.title)}</span> },
        { key: "category", label: "Category" },
        { key: "is_published", label: "Status", render: (r) => <span className="space-x-1"><PublishedBadge row={r} />{r.is_featured ? <Badge tone="warn">featured</Badge> : null}</span> },
      ]}
      fields={[
        { key: "title", label: "Title", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", help: "Leave empty to auto-generate" },
        { key: "summary", label: "Summary", type: "textarea" },
        { key: "category", label: "Category", type: "text" },
        { key: "stack", label: "Stack tags", type: "tags" },
        { key: "cover_image", label: "Cover image URL", type: "url", full: true },
        { key: "live_url", label: "Live URL", type: "url" },
        { key: "repo_url", label: "Repo URL", type: "url" },
        { key: "sort_order", label: "Sort order", type: "number" },
        { key: "is_published", label: "Published", type: "bool" },
        { key: "is_featured", label: "Featured on home", type: "bool" },
        { key: "media", label: "Screenshots / video", type: "media" },
        { key: "body", label: "Body", type: "markdown" },
      ]}
    />
  );
}
