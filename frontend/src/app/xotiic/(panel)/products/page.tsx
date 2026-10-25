"use client";

import { Badge } from "@/components/admin/kit";
import { PublishedBadge, ResourceManager } from "@/components/admin/ResourceManager";
import { CATEGORY_LABELS, SELL_TYPE_LABELS, money } from "@/lib/format";

export default function ProductsAdmin() {
  return (
    <ResourceManager
      title="Products"
      path="products"
      publicHref={(r) => `/store/${r.slug}`}
      defaults={{
        name: "", slug: "", tagline: "", description: "", features: [], category: "source_code", sell_type: "download",
        price_cents: 0, currency: "usd", media: [], deliverable_key: null, deliverable_filename: null, external_download_url: "", version: "",
        changelog: "", is_published: false, is_featured: false, is_bot: false, bot_id: null, sort_order: 0,
      }}
      columns={[
        { key: "name", label: "Name", render: (r) => <span className="text-white">{String(r.name)}</span> },
        { key: "category", label: "Category", render: (r) => CATEGORY_LABELS[String(r.category)] },
        { key: "price_cents", label: "Price", render: (r) => money(Number(r.price_cents), String(r.currency)) },
        { key: "sales_count", label: "Sales" },
        {
          key: "deliverable_key",
          label: "Delivery",
          render: (r) =>
            r.deliverable_key ? <Badge tone="ok">file</Badge> : r.external_download_url ? <Badge tone="info">link</Badge> : <Badge>none</Badge>,
        },
        { key: "is_published", label: "Status", render: (r) => <span className="space-x-1"><PublishedBadge row={r} />{r.is_featured ? <Badge tone="warn">featured</Badge> : null}</span> },
      ]}
      fields={[
        { key: "name", label: "Name", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", help: "Leave empty to auto-generate" },
        { key: "tagline", label: "Tagline", type: "text", full: true },
        { key: "category", label: "Category", type: "select", options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })) },
        { key: "sell_type", label: "Sell type", type: "select", options: Object.entries(SELL_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
        { key: "price_cents", label: "Price (USD)", type: "money", help: "0 = free / contact" },
        { key: "version", label: "Version", type: "text" },
        { key: "bot_id", label: "Linked bot", type: "relation", endpoint: "/options/bots", help: "Cross-links store ↔ /bots page" },
        { key: "sort_order", label: "Sort order", type: "number" },
        { key: "is_published", label: "Published", type: "bool" },
        { key: "is_featured", label: "Featured", type: "bool" },
        { key: "media", label: "Gallery (images / videos)", type: "media" },
        { key: "deliverable_key", label: "Deliverable (upload a file…)", type: "deliverable", filenameKey: "deliverable_filename" },
        {
          key: "external_download_url",
          label: "…or download link (for big files)",
          type: "url",
          full: true,
          help: "Google Drive / MEGA / Dropbox / Mediafire link. Only buyers get it, after paying, through their expiring download link. If a file is also uploaded, the file wins.",
        },
        { key: "features", label: "Feature bullets", type: "lines" },
        { key: "description", label: "Description", type: "markdown" },
        { key: "changelog", label: "Changelog", type: "markdown" },
      ]}
    />
  );
}
