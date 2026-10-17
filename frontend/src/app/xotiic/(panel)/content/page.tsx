"use client";

import { useEffect, useState } from "react";
import { PageTitle, Panel, Toggle, adminCall, useAdmin, useNotice } from "@/components/admin/kit";
import type { FreeTool } from "@/lib/types";

type Content = Record<string, unknown>;

const BLOCKS: { key: string; title: string; help: string }[] = [
  { key: "hero", title: "Hero", help: "eyebrow, title, subtitle, terminal_lines[], primary_cta {label, href}, secondary_cta" },
  { key: "ticker", title: "Ticker", help: "enabled, items[]: live order/bot counts are added automatically" },
  { key: "stats", title: "Stats overrides", help: "null = show live numbers; set a number/string to override" },
  { key: "about", title: "About page", help: "title, body (markdown)" },
  { key: "taglines", title: "Taglines", help: "list of strings" },
  { key: "socials", title: "Socials", help: "discord, github, youtube, x, tiktok: full URLs" },
  { key: "footer", title: "Footer", help: "blurb, support_email" },
  { key: "legal", title: "Legal pages", help: "terms, privacy, refund_policy, licenses (markdown)" },
];

export default function ContentAdmin() {
  const { data, reload } = useAdmin<Content>("/content");
  const { notice, ok, fail } = useNotice();

  async function save(key: string, value: unknown) {
    try {
      await adminCall(`/content/${key}`, "PUT", { value });
      ok(`${key} saved. Live within ~60s.`);
      reload();
    } catch (e) {
      fail(e);
    }
  }

  if (!data) return <div className="text-sm text-muted">loading…</div>;
  return (
    <div className="space-y-6">
      <PageTitle title="Site content" />
      <FreeToolsEditor value={data.free_tools as { enabled: boolean; headline: string; items: FreeTool[] }} onSave={(v) => save("free_tools", v)} />
      {BLOCKS.map((b) => (
        <JsonBlock key={b.key} title={b.title} help={b.help} value={data[b.key]} onSave={(v) => save(b.key, v)} />
      ))}
      {notice}
    </div>
  );
}

function FreeToolsEditor({ value, onSave }: { value: { enabled: boolean; headline: string; items: FreeTool[] }; onSave: (v: unknown) => void }) {
  const [state, setState] = useState(value);
  useEffect(() => setState(value), [value]);
  const setItem = (i: number, patch: Partial<FreeTool>) =>
    setState((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  return (
    <Panel title="Free tools (home banner, /tools, nav, footer)">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-6">
          <Toggle checked={state.enabled} onChange={(v) => setState((s) => ({ ...s, enabled: v }))} label="Show free tools" />
          <label className="flex-1">
            <span className="label">Headline</span>
            <input className="input" value={state.headline} onChange={(e) => setState((s) => ({ ...s, headline: e.target.value }))} />
          </label>
        </div>
        {state.items.map((it, i) => (
          <div key={i} className="grid gap-3 border border-line p-3 sm:grid-cols-2">
            <input className="input" value={it.name} placeholder="Name" onChange={(e) => setItem(i, { name: e.target.value })} />
            <input className="input" value={it.url} placeholder="https://…" onChange={(e) => setItem(i, { url: e.target.value })} />
            <textarea className="input sm:col-span-2" rows={2} value={it.description ?? ""} placeholder="Description" onChange={(e) => setItem(i, { description: e.target.value })} />
            <input className="input" value={it.badge ?? ""} placeholder="Badge (FREE)" onChange={(e) => setItem(i, { badge: e.target.value })} />
            <div className="flex items-center justify-between gap-3">
              <Toggle checked={!!it.featured} onChange={(v) => setItem(i, { featured: v })} label="Featured (home banner)" />
              <button className="text-xs text-dim hover:text-blood" onClick={() => setState((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}>
                remove
              </button>
            </div>
          </div>
        ))}
        <div className="flex justify-between">
          <button className="btn-ghost btn-sm" onClick={() => setState((s) => ({ ...s, items: [...s.items, { name: "", url: "https://", badge: "FREE" }] }))}>
            + Add tool
          </button>
          <button className="btn-primary btn-sm" onClick={() => onSave(state)}>
            Save free tools
          </button>
        </div>
      </div>
    </Panel>
  );
}

function JsonBlock({ title, help, value, onSave }: { title: string; help: string; value: unknown; onSave: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);

  function save() {
    try {
      const parsed = JSON.parse(text);
      setErr(null);
      onSave(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <Panel title={title}>
      <div className="space-y-2 p-4">
        <p className="text-[11px] text-dim">{help}</p>
        <textarea className="input font-mono text-xs leading-5" rows={Math.min(18, text.split("\n").length + 1)} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        {err && <div className="text-xs text-blood">! {err}</div>}
        <div className="flex justify-end">
          <button className="btn-ghost btn-sm" onClick={save}>
            Save {title.toLowerCase()}
          </button>
        </div>
      </div>
    </Panel>
  );
}
