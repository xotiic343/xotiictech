"use client";

import { PublishedBadge, ResourceManager } from "@/components/admin/ResourceManager";

export default function TestimonialsAdmin() {
  return (
    <ResourceManager
      title="Testimonials"
      path="testimonials"
      defaults={{ name: "", role: "", quote: "", avatar_url: "", rating: 5, sort_order: 0, is_published: true }}
      columns={[
        { key: "name", label: "Name", render: (r) => <span className="text-white">{String(r.name)}</span> },
        { key: "quote", label: "Quote", render: (r) => <span className="line-clamp-2 max-w-md text-muted">{String(r.quote)}</span> },
        { key: "rating", label: "★" },
        { key: "is_published", label: "Status", render: (r) => <PublishedBadge row={r} /> },
      ]}
      fields={[
        { key: "name", label: "Name", type: "text", required: true },
        { key: "role", label: "Role / server", type: "text" },
        { key: "avatar_url", label: "Avatar URL", type: "url", full: true },
        { key: "rating", label: "Rating (1–5)", type: "number" },
        { key: "sort_order", label: "Sort order", type: "number" },
        { key: "is_published", label: "Published", type: "bool" },
        { key: "quote", label: "Quote", type: "textarea" },
      ]}
    />
  );
}
