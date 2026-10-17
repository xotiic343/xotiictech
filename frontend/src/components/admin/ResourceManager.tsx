"use client";

import { useEffect, useState } from "react";
import { Badge, Drawer, PageTitle, Panel, Table, Toggle, adminCall, useAdmin, useNotice } from "@/components/admin/kit";
import { DeliverableUpload, MediaEditor } from "@/components/admin/uploads";
import { api } from "@/lib/client";
import type { Media } from "@/lib/types";

type Row = Record<string, unknown> & { id: number };

export type FieldDef =
  | { key: string; label: string; type: "text" | "url" | "textarea" | "markdown"; required?: boolean; help?: string; full?: boolean }
  | { key: string; label: string; type: "number"; help?: string }
  | { key: string; label: string; type: "money"; help?: string }
  | { key: string; label: string; type: "bool" }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; nullable?: boolean }
  | { key: string; label: string; type: "relation"; endpoint: string; help?: string }
  | { key: string; label: string; type: "tags" | "lines"; help?: string; full?: boolean }
  | { key: string; label: string; type: "media" }
  | { key: string; label: string; type: "deliverable"; filenameKey: string };

export type Column = { key: string; label: string; render?: (row: Row) => React.ReactNode };

export function ResourceManager({
  title,
  path,
  fields,
  columns,
  defaults,
  publicHref,
}: {
  title: string;
  path: string;
  fields: FieldDef[];
  columns: Column[];
  defaults: Record<string, unknown>;
  publicHref?: (row: Row) => string | null;
}) {
  const { data, reload } = useAdmin<{ items: Row[] }>(`/${path}`);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const { notice, ok, fail } = useNotice();

  const items = (data?.items ?? []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  async function save() {
    if (!editing) return;
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      let v = editing[f.key];
      if (f.type === "deliverable") payload[f.filenameKey] = editing[f.filenameKey] ?? null;
      if ((f.type === "text" || f.type === "url") && v === "") v = f.required ? "" : null;
      if (f.type === "relation" && (v === "" || v === undefined)) v = null;
      if (f.type === "number" && (v === "" || v === undefined)) v = 0;
      payload[f.key] = v;
    }
    if ("slug" in payload && !payload.slug) payload.slug = null;
    try {
      if (editing.id) await adminCall(`/${path}/${editing.id}`, "PUT", payload);
      else await adminCall(`/${path}`, "POST", payload);
      ok("Saved");
      setEditing(null);
      reload();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete "${String(row.name ?? row.title ?? row.id)}"? This cannot be undone.`)) return;
    try {
      await adminCall(`/${path}/${row.id}`, "DELETE");
      ok("Deleted");
      reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div>
      <PageTitle title={title}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter…" className="input w-48 py-1.5 text-xs" />
        <button className="btn-primary btn-sm" onClick={() => setEditing({ ...defaults })}>
          + New
        </button>
      </PageTitle>
      <Panel>
        <Table head={[...columns.map((c) => c.label), ""]} empty={!items.length}>
          {items.map((row) => (
            <tr key={row.id} className="hover:bg-panel">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 align-top">
                  {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                {publicHref?.(row) && (
                  <a href={publicHref(row)!} target="_blank" rel="noopener noreferrer" className="mr-3 text-muted hover:text-white">
                    view
                  </a>
                )}
                <button onClick={() => setEditing({ ...row })} className="mr-3 text-blood hover:text-white">
                  edit
                </button>
                <button onClick={() => remove(row)} className="text-dim hover:text-blood">
                  delete
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}>
        {editing && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <FieldInput key={f.key} field={f} value={editing[f.key]} row={editing} onChange={(k, v) => setEditing((e) => ({ ...e!, [k]: v }))} />
              ))}
            </div>
            <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-line bg-black px-5 py-4">
              <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </Drawer>
      {notice}
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  row,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  row: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  const wide =
    ["textarea", "markdown", "media", "deliverable", "lines"].includes(f.type) || ("full" in f && f.full) ? "sm:col-span-2" : "";
  const help = "help" in f && f.help ? <span className="mt-1 block text-[11px] text-dim">{f.help}</span> : null;

  let control: React.ReactNode;
  switch (f.type) {
    case "text":
    case "url":
      control = <input className="input" value={(value as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value)} type={f.type === "url" ? "url" : "text"} />;
      break;
    case "textarea":
      control = <textarea className="input" rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />;
      break;
    case "markdown":
      control = (
        <textarea className="input font-mono text-xs leading-5" rows={14} value={(value as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value)} placeholder="Markdown supported" />
      );
      break;
    case "number":
      control = <input className="input" type="number" value={(value as number) ?? 0} onChange={(e) => onChange(f.key, Number(e.target.value))} />;
      break;
    case "money":
      control = (
        <input
          className="input"
          type="number"
          step="0.01"
          min="0"
          value={((value as number) ?? 0) / 100}
          onChange={(e) => onChange(f.key, Math.round(Number(e.target.value) * 100))}
        />
      );
      break;
    case "bool":
      return (
        <div className="flex items-end pb-2">
          <Toggle checked={!!value} onChange={(v) => onChange(f.key, v)} label={f.label} />
        </div>
      );
    case "select":
      control = (
        <select className="input" value={(value as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value || null)}>
          {f.nullable && <option value="">—</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "relation":
      control = <RelationSelect endpoint={f.endpoint} value={value as number | null} onChange={(v) => onChange(f.key, v)} />;
      break;
    case "tags":
      control = (
        <input
          className="input"
          defaultValue={((value as string[]) ?? []).join(", ")}
          onChange={(e) => onChange(f.key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          placeholder="comma, separated"
        />
      );
      break;
    case "lines":
      control = (
        <textarea
          className="input"
          rows={5}
          defaultValue={((value as string[]) ?? []).join("\n")}
          onChange={(e) => onChange(f.key, e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="one per line"
        />
      );
      break;
    case "media":
      control = <MediaEditor value={(value as Media[]) ?? []} onChange={(m) => onChange(f.key, m)} />;
      break;
    case "deliverable":
      control = (
        <DeliverableUpload
          keyValue={(value as string) ?? null}
          filename={(row[f.filenameKey] as string) ?? null}
          onChange={(k, name) => {
            onChange(f.key, k);
            onChange(f.filenameKey, name);
          }}
        />
      );
      break;
  }
  return (
    <label className={`block ${wide}`}>
      <span className="label">{f.label}</span>
      {control}
      {help}
    </label>
  );
}

function RelationSelect({ endpoint, value, onChange }: { endpoint: string; value: number | null; onChange: (v: number | null) => void }) {
  const [opts, setOpts] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    api<{ items: { id: number; name: string }[] }>(`/admin${endpoint}`).then((r) => setOpts(r.items)).catch(() => {});
  }, [endpoint]);
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">— none —</option>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

export function PublishedBadge({ row }: { row: Row }) {
  return row.is_published ? <Badge tone="ok">live</Badge> : <Badge>draft</Badge>;
}
