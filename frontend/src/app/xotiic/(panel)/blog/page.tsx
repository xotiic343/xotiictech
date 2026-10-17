"use client";

import { PublishedBadge, ResourceManager } from "@/components/admin/ResourceManager";
import { date } from "@/lib/format";

export default function BlogAdmin() {
  return (
    <ResourceManager
      title="Blog posts"
      path="blog"
      publicHref={(r) => (r.is_published ? `/blog/${r.slug}` : null)}
      defaults={{ title: "", slug: "", excerpt: "", body: "", kind: "announcement", tags: [], cover_image: "", is_published: false }}
      columns={[
        { key: "title", label: "Title", render: (r) => <span className="text-white">{String(r.title)}</span> },
        { key: "kind", label: "Kind" },
        { key: "published_at", label: "Published", render: (r) => date(r.published_at as string) },
        { key: "is_published", label: "Status", render: (r) => <PublishedBadge row={r} /> },
      ]}
      fields={[
        { key: "title", label: "Title", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", help: "Leave empty to auto-generate" },
        {
          key: "kind",
          label: "Kind",
          type: "select",
          options: [
            { value: "announcement", label: "Announcement" },
            { value: "tutorial", label: "Tutorial" },
            { value: "changelog", label: "Changelog (shows on /changelog)" },
          ],
        },
        { key: "tags", label: "Tags", type: "tags" },
        { key: "cover_image", label: "Cover image URL", type: "url", full: true },
        { key: "excerpt", label: "Excerpt", type: "textarea" },
        { key: "is_published", label: "Published", type: "bool" },
        { key: "body", label: "Body", type: "markdown" },
      ]}
    />
  );
}
