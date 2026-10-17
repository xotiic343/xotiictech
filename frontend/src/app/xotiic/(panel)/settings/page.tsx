"use client";

import { useEffect, useState } from "react";
import { Badge, PageTitle, Panel, Toggle, adminCall, useAdmin, useNotice } from "@/components/admin/kit";

type Settings = {
  values: {
    download_expiry_hours: number;
    max_downloads_per_order: number;
    discord_sync_interval_minutes: number;
    auto_publish_new_bots: boolean;
    reviews_require_approval: boolean;
    email_order_subject: string;
    email_order_body: string;
    email_magic_link_subject: string;
  };
  readonly: Record<string, string | number | boolean>;
};

export default function SettingsAdmin() {
  const { data, reload } = useAdmin<Settings>("/settings");
  const [v, setV] = useState<Settings["values"] | null>(null);
  const { notice, ok, fail } = useNotice();
  useEffect(() => {
    if (data) setV(data.values);
  }, [data]);
  if (!data || !v) return <div className="text-sm text-muted">loading…</div>;

  const set = <K extends keyof Settings["values"]>(k: K, val: Settings["values"][K]) => setV({ ...v, [k]: val });

  async function save() {
    try {
      await adminCall("/settings", "PUT", v);
      ok("Settings saved");
      reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Settings">
        <button className="btn-primary btn-sm" onClick={save}>
          Save settings
        </button>
      </PageTitle>

      <Panel title="Delivery">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Num label="Download link expiry (hours)" value={v.download_expiry_hours} onChange={(n) => set("download_expiry_hours", n)} />
          <Num label="Max downloads per order (0 = unlimited)" value={v.max_downloads_per_order} onChange={(n) => set("max_downloads_per_order", n)} />
        </div>
      </Panel>

      <Panel title="Discord sync">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Num label="Sync interval (minutes, 5–1440)" value={v.discord_sync_interval_minutes} onChange={(n) => set("discord_sync_interval_minutes", n)} />
          <div className="flex flex-col justify-end gap-3 pb-1">
            <Toggle checked={v.auto_publish_new_bots} onChange={(b) => set("auto_publish_new_bots", b)} label="Auto-publish newly discovered bots" />
            <Toggle checked={v.reviews_require_approval} onChange={(b) => set("reviews_require_approval", b)} label="Reviews require approval" />
          </div>
        </div>
      </Panel>

      <Panel title="Email templates: placeholders {product} {link} {expires} {account_url}">
        <div className="space-y-4 p-4">
          <label className="block">
            <span className="label">Order email subject</span>
            <input className="input" value={v.email_order_subject} onChange={(e) => set("email_order_subject", e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Order email body</span>
            <textarea className="input font-mono text-xs" rows={8} value={v.email_order_body} onChange={(e) => set("email_order_body", e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Magic-link email subject</span>
            <input className="input" value={v.email_magic_link_subject} onChange={(e) => set("email_magic_link_subject", e.target.value)} />
          </label>
        </div>
      </Panel>

      <Panel title="Environment (read-only, set in Render)">
        <div className="grid gap-2 p-4 text-sm sm:grid-cols-2">
          {Object.entries(data.readonly).map(([k, val]) => (
            <div key={k} className="flex items-center justify-between border-b border-line py-1.5">
              <span className="text-xs text-dim">{k.replaceAll("_", " ")}</span>
              {typeof val === "boolean" ? <Badge tone={val ? "ok" : "warn"}>{val ? "yes" : "no"}</Badge> : <span className="font-mono text-xs text-white">{String(val) || "—"}</span>}
            </div>
          ))}
        </div>
      </Panel>
      {notice}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="number" className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
