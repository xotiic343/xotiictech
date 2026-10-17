"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, PageTitle, Panel, Toggle, adminCall, statusTone, useAdmin, useNotice } from "@/components/admin/kit";
import { MediaEditor } from "@/components/admin/uploads";
import { compact, timeAgo } from "@/lib/format";
import type { Media } from "@/lib/types";

type Cmd = { id: number; name: string; description: string | null; is_hidden: boolean; guild_scoped: boolean };
type AdminBot = {
  id: number;
  slug: string;
  name: string;
  username: string;
  discord_id: string;
  application_id: string | null;
  avatar_url: string;
  invite_url: string | null;
  status: string;
  guild_count: number;
  app_description: string | null;
  app_tags: string[];
  last_synced_at: string | null;
  last_error: string | null;
  display_name: string | null;
  short_description: string | null;
  long_description: string | null;
  tags: string[] | null;
  category: string | null;
  pricing_type: string;
  price_label: string | null;
  media: Media[];
  support_url: string | null;
  website_url: string | null;
  invite_permissions: string | null;
  version: string | null;
  changelog: string | null;
  is_featured: boolean;
  is_hidden: boolean;
  is_published: boolean;
  sort_order: number;
  commands: Cmd[];
  products: { id: number; name: string; slug: string }[];
  reviews: { id: number; author: string; rating: number; body: string; is_approved: boolean }[];
};

const OVERRIDE_KEYS = [
  "slug", "display_name", "short_description", "long_description", "category", "pricing_type", "price_label",
  "support_url", "website_url", "invite_permissions", "version", "changelog", "is_featured", "is_hidden", "sort_order", "media",
] as const;

export default function BotEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, reload } = useAdmin<AdminBot>(`/bots/${id}`);
  const [form, setForm] = useState<Partial<AdminBot> & { tagsText?: string; useSyncedTags?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const { notice, ok, fail } = useNotice();

  useEffect(() => {
    if (data) setForm({ ...data, tagsText: (data.tags ?? []).join(", "), useSyncedTags: data.tags === null });
  }, [data]);

  if (!data) return <div className="text-sm text-muted">loading…</div>;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const k of OVERRIDE_KEYS) payload[k] = form[k] ?? (typeof data![k] === "boolean" ? false : null);
    payload.slug = form.slug || data!.slug;
    payload.tags = form.useSyncedTags ? null : (form.tagsText ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await adminCall(`/bots/${id}`, "PATCH", payload);
      ok("Overrides saved");
      reload();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function action(path: string, method = "POST", msg = "Done") {
    try {
      await adminCall(path, method);
      ok(msg);
      reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/xotiic/bots" className="text-[11px] uppercase tracking-[0.2em] text-dim hover:text-blood">
        ← bots
      </Link>
      <PageTitle title={data.name}>
        {data.is_published ? (
          <>
            <a href={`/bots/${data.slug}`} target="_blank" className="btn-ghost btn-sm">
              View live ↗
            </a>
            <button className="btn-ghost btn-sm" onClick={() => action(`/bots/${id}/unpublish`, "POST", "Unpublished")}>
              Unpublish
            </button>
          </>
        ) : (
          <button className="btn-primary btn-sm" onClick={() => action(`/bots/${id}/publish`, "POST", "Published")}>
            Publish
          </button>
        )}
        <button
          className="btn-sm text-dim hover:text-blood"
          onClick={async () => {
            if (!confirm("Delete this bot record? If its token is still configured it will be re-imported (unpublished) on next sync.")) return;
            await adminCall(`/bots/${id}`, "DELETE").then(() => router.replace("/xotiic/bots"), fail);
          }}
        >
          Delete
        </button>
      </PageTitle>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Overrides: these win over synced Discord data">
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Input label="Display name" value={form.display_name} placeholder={data.username} onChange={(v) => set("display_name", v)} />
              <Input label="Slug" value={form.slug} onChange={(v) => set("slug", v)} />
              <Input label="Short description" value={form.short_description} placeholder={(data.app_description ?? "").slice(0, 120)} onChange={(v) => set("short_description", v)} wide />
              <Input label="Category" value={form.category} onChange={(v) => set("category", v)} />
              <label className="block">
                <span className="label">Pricing</span>
                <select className="input" value={form.pricing_type ?? "free"} onChange={(e) => set("pricing_type", e.target.value)}>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <Input label="Price label" value={form.price_label} placeholder="e.g. from $9.99/mo" onChange={(v) => set("price_label", v)} />
              <Input label="Version" value={form.version} onChange={(v) => set("version", v)} />
              <Input label="Support server URL" value={form.support_url} onChange={(v) => set("support_url", v)} />
              <Input label="Website URL" value={form.website_url} onChange={(v) => set("website_url", v)} />
              <Input label="Invite permissions (integer)" value={form.invite_permissions} placeholder="from Discord install settings" onChange={(v) => set("invite_permissions", v)} />
              <Input label="Sort order" value={String(form.sort_order ?? 0)} onChange={(v) => set("sort_order", Number(v) || 0)} />
              <div className="sm:col-span-2">
                <span className="label">Tags</span>
                <Toggle checked={!!form.useSyncedTags} onChange={(v) => set("useSyncedTags", v)} label={`Use Discord app tags (${data.app_tags.join(", ") || "none"})`} />
                {!form.useSyncedTags && <input className="input mt-2" value={form.tagsText ?? ""} onChange={(e) => set("tagsText", e.target.value)} placeholder="moderation, tickets" />}
              </div>
              <div className="flex flex-wrap gap-6 sm:col-span-2">
                <Toggle checked={!!form.is_featured} onChange={(v) => set("is_featured", v)} label="Featured" />
                <Toggle checked={!!form.is_hidden} onChange={(v) => set("is_hidden", v)} label="Hidden (never shown)" />
              </div>
              <label className="block sm:col-span-2">
                <span className="label">Long description (markdown; empty = Discord app description)</span>
                <textarea className="input font-mono text-xs" rows={10} value={form.long_description ?? ""} onChange={(e) => set("long_description", e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="label">Changelog (markdown)</span>
                <textarea className="input font-mono text-xs" rows={6} value={form.changelog ?? ""} onChange={(e) => set("changelog", e.target.value)} />
              </label>
              <div className="sm:col-span-2">
                <span className="label">Screenshots / demo GIFs / video</span>
                <MediaEditor value={form.media ?? []} onChange={(m) => set("media", m)} />
              </div>
            </div>
            <div className="flex justify-end border-t border-line p-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save overrides"}
              </button>
            </div>
          </Panel>

          <Panel title={`Commands (${data.commands.length}): toggle visibility on the public page`}>
            <div className="divide-y divide-line">
              {data.commands.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <code className={c.is_hidden ? "text-dim line-through" : "text-blood"}>/{c.name}</code>
                  <span className="flex-1 truncate text-muted">{c.description}</span>
                  {c.guild_scoped && <Badge tone="info">guild</Badge>}
                  <button
                    onClick={() =>
                      adminCall(`/bots/${id}/commands/${c.id}`, "PATCH", { is_hidden: !c.is_hidden }).then(() => reload(), fail)
                    }
                    className="text-xs text-muted hover:text-white"
                  >
                    {c.is_hidden ? "show" : "hide"}
                  </button>
                </div>
              ))}
              {!data.commands.length && <div className="px-4 py-6 text-sm text-dim">No commands synced.</div>}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Synced from Discord">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.avatar_url} alt="" className="h-14 w-14 border border-edge" />
                <div>
                  <div className="text-white">{data.username}</div>
                  <Badge tone={statusTone(data.status)}>{data.status}</Badge>
                </div>
              </div>
              <Row k="Discord ID" v={data.discord_id} />
              <Row k="Application ID" v={data.application_id ?? "—"} />
              <Row k="Servers" v={compact(data.guild_count)} />
              <Row k="Last sync" v={timeAgo(data.last_synced_at)} />
              {data.last_error && <div className="border border-blood/40 bg-blood/5 p-2 text-xs text-blood">{data.last_error}</div>}
              {data.app_description && <p className="text-xs text-muted">{data.app_description}</p>}
              {data.invite_url && (
                <a href={data.invite_url} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-blood">
                  {data.invite_url}
                </a>
              )}
            </div>
          </Panel>

          <Panel title="Linked store products">
            <div className="space-y-2 p-4 text-sm">
              {data.products.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="text-white">{p.name}</span>
                  <a href={`/store/${p.slug}`} target="_blank" className="text-xs text-blood">
                    view ↗
                  </a>
                </div>
              ))}
              {!data.products.length && <p className="text-xs text-dim">None. Link one from Products → Linked bot.</p>}
              <Link href="/xotiic/products" className="btn-ghost btn-sm mt-2">
                Manage products
              </Link>
            </div>
          </Panel>

          <Panel title={`Reviews (${data.reviews.length})`}>
            <div className="divide-y divide-line">
              {data.reviews.map((r) => (
                <div key={r.id} className="space-y-1 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white">{r.author}</span>
                    <span className="text-amber">{"★".repeat(r.rating)}</span>
                  </div>
                  <p className="text-xs text-muted">{r.body}</p>
                  <button
                    className="text-xs text-blood"
                    onClick={() => adminCall(`/bots/reviews/${r.id}`, "PATCH", { is_approved: !r.is_approved }).then(() => reload(), fail)}
                  >
                    {r.is_approved ? "hide" : "approve"}
                  </button>
                </div>
              ))}
              {!data.reviews.length && <div className="p-4 text-xs text-dim">No reviews.</div>}
            </div>
          </Panel>
        </div>
      </div>
      {notice}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, wide }: { label: string; value: string | null | undefined; onChange: (v: string) => void; placeholder?: string; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      <input className="input" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line pb-1.5 text-xs">
      <span className="text-dim">{k}</span>
      <span className="font-mono text-neutral-300">{v}</span>
    </div>
  );
}
