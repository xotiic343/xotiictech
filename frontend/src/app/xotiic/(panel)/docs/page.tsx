"use client";

import { PublishedBadge, ResourceManager } from "@/components/admin/ResourceManager";

export default function DocsAdmin() {
  return (
    <ResourceManager
      title="Docs & FAQ"
      path="docs"
      publicHref={(r) => `/docs/${r.slug}`}
      defaults={{ title: "", slug: "", section: "guides", body: "", product_id: null, bot_id: null, sort_order: 0, is_published: false }}
      columns={[
        { key: "title", label: "Title", render: (r) => <span className="text-white">{String(r.title)}</span> },
        { key: "section", label: "Section" },
        { key: "sort_order", label: "Order" },
        { key: "is_published", label: "Status", render: (r) => <PublishedBadge row={r} /> },
      ]}
      fields={[
        { key: "title", label: "Title / question", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", help: "Leave empty to auto-generate" },
        { key: "section", label: "Section", type: "text", required: true, help: "'faq' shows in the FAQ accordion; anything else groups guides" },
        { key: "sort_order", label: "Sort order", type: "number" },
        { key: "product_id", label: "Related product", type: "relation", endpoint: "/options/products" },
        { key: "bot_id", label: "Related bot", type: "relation", endpoint: "/options/bots" },
        { key: "is_published", label: "Published", type: "bool" },
        { key: "body", label: "Body / answer", type: "markdown" },
      ]}
    />
  );
}
