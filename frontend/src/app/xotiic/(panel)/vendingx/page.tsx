"use client";

import { useRef, useState } from "react";
import { Badge, Drawer, PageTitle, Panel, Table, Toggle, adminCall, useAdmin, useNotice } from "@/components/admin/kit";
import { uploadFile } from "@/components/admin/uploads";
import { StockIcon } from "@/components/vendingx/StockIcon";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";

type StockType = {
  key: string;
  name: string;
  description: string;
  is_premium: boolean;
  icon_url: string | null;
  sort_order: number;
  count: number;
};

type Overview = {
  stats: { total_stock: number; total_vends: number; vends_today: number; users: number };
  types: StockType[];
  recent: { username: string; item: string; source: string; time: string }[];
  top_users: { user_id: string; username: string; vends: number; last: string | null }[];
};

const NEW = "__new__";

function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="border border-line bg-ink px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-white">{value === undefined ? "—" : value.toLocaleString()}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-dim">{children}</label>;
}

export default function VendingXAdmin() {
  const { data, error, loading, reload } = useAdmin<Overview>("/vendingx");
  const { notice, ok, fail } = useNotice();
  const [editing, setEditing] = useState<StockType | null>(null);

  const types = data?.types ?? [];

  async function clearType(t: StockType) {
    if (!confirm(`Delete all ${t.count} unsold items in "${t.name}"?`)) return;
    try {
      const r = await adminCall<{ removed: number }>(`/vendingx/types/${encodeURIComponent(t.key)}/clear`, "POST");
      ok(`Removed ${r.removed} items from ${t.name}`);
      reload();
    } catch (e) {
      fail(e);
    }
  }

  async function deleteType(t: StockType) {
    if (!confirm(`Delete "${t.name}" and its ${t.count} unsold items? If the Discord bot still has a ${t.key}.txt file, it comes back on the next sync.`)) return;
    try {
      await adminCall(`/vendingx/types/${encodeURIComponent(t.key)}`, "DELETE");
      ok(`Deleted ${t.name}`);
      setEditing(null);
      reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Vending X">
        <a href="/vendingx" target="_blank" className="btn-ghost btn-sm">
          View page ↗
        </a>
        <button className="btn-ghost btn-sm" onClick={reload}>
          Refresh
        </button>
      </PageTitle>

      {error && <div className="border border-blood/40 bg-blood/5 px-4 py-3 text-xs text-blood">! {error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Items in stock" value={data?.stats.total_stock} />
        <Tile label="Total vends" value={data?.stats.total_vends} />
        <Tile label="Vends today" value={data?.stats.vends_today} />
        <Tile label="Users" value={data?.stats.users} />
      </div>

      <UploadPanel types={types} onDone={(msg) => { ok(msg); reload(); }} onError={fail} />

      <Panel title={`Stock inventory (${types.length} types)`}>
        <Table head={["", "Name", "Key", "Tier", "Stock", "Order", ""]} empty={!loading && !types.length}>
          {types.map((t) => (
            <tr key={t.key} className="hover:bg-crimson/5">
              <td className="w-12 px-4 py-2">
                <span className="grid h-9 w-9 place-items-center border border-line bg-black text-muted">
                  <StockIcon icon={t.icon_url} stockKey={t.key} name={t.name} className="h-6 w-6" />
                </span>
              </td>
              <td className="px-4 py-2 text-white">{t.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-dim">{t.key}</td>
              <td className="px-4 py-2">
                <Badge tone={t.is_premium ? "warn" : "ok"}>{t.is_premium ? "premium" : "free"}</Badge>
              </td>
              <td className="px-4 py-2">
                <Badge tone={t.count > 0 ? "muted" : "bad"}>{t.count > 0 ? t.count.toLocaleString() : "empty"}</Badge>
              </td>
              <td className="px-4 py-2 font-mono text-xs text-dim">{t.sort_order}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <button className="btn-ghost btn-sm" onClick={() => setEditing(t)}>
                  Edit
                </button>
                <button className="btn-sm ml-2 text-blood disabled:opacity-30" disabled={!t.count} onClick={() => clearType(t)}>
                  Clear
                </button>
              </td>
            </tr>
          ))}
        </Table>
        <p className="border-t border-line px-4 py-2 text-[10px] text-dim">
          Stock from the Discord bot syncs every 5 minutes. Names, tiers and icons you set here are kept on every sync.
        </p>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent vends">
          <Table head={["User", "Item", "Source", "When"]} empty={!loading && !data?.recent.length}>
            {data?.recent.map((r, i) => (
              <tr key={i} className="hover:bg-crimson/5">
                <td className="px-4 py-2 text-white">{r.username}</td>
                <td className="px-4 py-2">{r.item}</td>
                <td className="px-4 py-2">
                  <Badge tone={r.source === "BOT" ? "info" : "warn"}>{r.source}</Badge>
                </td>
                <td className="px-4 py-2 text-dim">{timeAgo(r.time)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Top users">
          <Table head={["User", "Discord ID", "Vends", "Last"]} empty={!loading && !data?.top_users.length}>
            {data?.top_users.map((u) => (
              <tr key={u.user_id} className="hover:bg-crimson/5">
                <td className="px-4 py-2 text-white">{u.username}</td>
                <td className="px-4 py-2 font-mono text-xs text-dim">{u.user_id}</td>
                <td className="px-4 py-2 font-mono">{u.vends}</td>
                <td className="px-4 py-2 text-dim">{u.last ? timeAgo(u.last) : "—"}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""}>
        {editing && (
          <TypeEditor
            key={editing.key}
            type={editing}
            onSaved={() => { ok("Saved"); setEditing(null); reload(); }}
            onDelete={() => deleteType(editing)}
            onError={fail}
          />
        )}
      </Drawer>

      {notice}
    </div>
  );
}

function UploadPanel({
  types,
  onDone,
  onError,
}: {
  types: StockType[];
  onDone: (msg: string) => void;
  onError: (e: unknown) => void;
}) {
  const [choice, setChoice] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newPremium, setNewPremium] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isNew = choice === NEW;
  const keyPreview = newKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const ready = isNew ? !!keyPreview : !!choice;

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return onError(new Error("Choose a .txt file first"));
    setBusy(true);
    try {
      const form = new FormData();
      form.append("stock_key", isNew ? newKey : choice);
      form.append("file", file);
      if (isNew) {
        form.append("name", newName);
        form.append("is_premium", String(newPremium));
      }
      const r = await api<{ key: string; created: boolean; added: number; skipped: number; total: number }>(
        "/admin/vendingx/upload",
        { method: "POST", body: form },
      );
      onDone(
        `${r.created ? `Created "${r.key}". ` : ""}Added ${r.added}` +
          (r.skipped ? `, skipped ${r.skipped} duplicates` : "") +
          ` (${r.total} in stock)`,
      );
      if (fileRef.current) fileRef.current.value = "";
      if (isNew) {
        setChoice(r.key);
        setNewKey("");
        setNewName("");
        setNewPremium(false);
      }
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Upload stock">
      <div className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div>
          <Label>Stock type</Label>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="input w-full">
            <option value="">Select type…</option>
            <option value={NEW}>+ New custom type…</option>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.is_premium ? "★ " : ""}
                {t.name} ({t.count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>.txt file (one item per line)</Label>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="input w-full file:mr-3 file:border-0 file:bg-crimson/20 file:px-3 file:py-1 file:text-xs file:text-blood"
          />
        </div>
        <button onClick={upload} disabled={busy || !ready} className="btn-primary px-6 py-2 disabled:opacity-40">
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      {isNew && (
        <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label>Type key</Label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="disney_plus" className="input w-full" maxLength={80} />
            <div className="mt-1 text-[10px] text-dim">
              Saved as <span className="font-mono text-muted">{keyPreview || "…"}</span>
            </div>
          </div>
          <div>
            <Label>Display name</Label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Disney+" className="input w-full" maxLength={120} />
            <div className="mt-1 text-[10px] text-dim">Leave blank to use the key</div>
          </div>
          <div className="pb-5">
            <Toggle checked={newPremium} onChange={setNewPremium} label="Premium only" />
          </div>
        </div>
      )}

      <p className="border-t border-line px-4 py-2 text-[10px] text-dim">
        One item per line. Blank lines and duplicates (including items already given out) are skipped. Max 5 MB.
      </p>
    </Panel>
  );
}

function TypeEditor({
  type,
  onSaved,
  onDelete,
  onError,
}: {
  type: StockType;
  onSaved: () => void;
  onDelete: () => void;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description);
  const [premium, setPremium] = useState(type.is_premium);
  const [sortOrder, setSortOrder] = useState(String(type.sort_order));
  const [icon, setIcon] = useState(type.icon_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const iconRef = useRef<HTMLInputElement>(null);

  async function onIconFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try {
      const r = await uploadFile(f, "media", () => undefined);
      if (!r.url) throw new Error("Upload returned no URL");
      setIcon(r.url);
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
      if (iconRef.current) iconRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      await adminCall(`/vendingx/types/${encodeURIComponent(type.key)}`, "PATCH", {
        name: name.trim() || type.name,
        description: description.trim(),
        is_premium: premium,
        sort_order: Number.parseInt(sortOrder, 10) || 0,
        icon_url: icon.trim(),
      });
      onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5">
        <div className="grid h-24 w-24 shrink-0 place-items-center border border-line bg-[radial-gradient(circle_at_50%_35%,#2a0a0a,#000)] text-neutral-300">
          <StockIcon icon={icon || null} stockKey={type.key} name={name} className="h-14 w-14" />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input ref={iconRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => onIconFile(e.target.files?.[0])} />
            <button type="button" className="btn-ghost btn-sm" disabled={uploading} onClick={() => iconRef.current?.click()}>
              {uploading ? "Uploading…" : "Upload icon"}
            </button>
            {icon && (
              <button type="button" className="btn-sm text-blood" onClick={() => setIcon("")}>
                Use default icon
              </button>
            )}
          </div>
          <p className="text-[11px] text-dim">Square PNG with a transparent background looks best (256×256 or bigger).</p>
        </div>
      </div>

      <div>
        <Label>…or icon URL</Label>
        <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="https://…/icon.png" className="input w-full" />
      </div>
      <div>
        <Label>Display name</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" maxLength={120} />
      </div>
      <div>
        <Label>Description</Label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full" maxLength={300} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Sort order (lower comes first)</Label>
          <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" className="input w-full" />
        </div>
        <div className="flex items-end pb-2">
          <Toggle checked={premium} onChange={setPremium} label="Premium only" />
        </div>
      </div>
      <div className="font-mono text-[11px] text-dim">
        key: {type.key} · {type.count} in stock
      </div>

      <div className="flex justify-between border-t border-line pt-5">
        <button className="btn-sm text-blood" onClick={onDelete}>
          Delete type
        </button>
        <button className="btn-primary px-6" disabled={saving || uploading} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
