"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Media } from "@/lib/types";

async function upload(file: File, kind: "media" | "deliverable") {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  return api<{ url?: string; key?: string; filename?: string; type?: "image" | "video" }>("/admin/uploads", { method: "POST", body: fd });
}

/** Ordered list of images/videos with upload, URL add, reorder and remove. */
export function MediaEditor({ value, onChange }: { value: Media[]; onChange: (m: Media[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    const added: Media[] = [];
    try {
      for (const f of Array.from(files)) {
        const r = await upload(f, "media");
        if (r.url) added.push({ type: r.type ?? "image", url: r.url, alt: "" });
      }
      onChange([...value, ...added]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      if (added.length) onChange([...value, ...added]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {value.map((m, i) => (
          <div key={m.url + i} className="group relative aspect-video border border-line bg-panel">
            {m.type === "video" ? (
              <video src={m.url} className="h-full w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/80 px-1 py-0.5 text-xs opacity-0 transition group-hover:opacity-100">
              <span className="space-x-1">
                <button type="button" onClick={() => move(i, -1)} className="px-1 text-white">
                  ←
                </button>
                <button type="button" onClick={() => move(i, 1)} className="px-1 text-white">
                  →
                </button>
              </span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="px-1 text-blood">
                remove
              </button>
            </div>
            {i === 0 && <span className="absolute left-1 top-1 bg-crimson px-1 text-[9px] uppercase text-black">cover</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" hidden onChange={(e) => onFiles(e.target.files)} />
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "+ Upload media"}
        </button>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an https:// URL" className="input flex-1 py-1.5 text-xs" />
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            if (!/^https?:\/\//.test(url)) return setErr("URL must start with https://");
            onChange([...value, { type: /\.(mp4|webm)$/i.test(url) ? "video" : "image", url, alt: "" }]);
            setUrl("");
          }}
        >
          Add URL
        </button>
      </div>
      {err && <div className="text-xs text-blood">! {err}</div>}
    </div>
  );
}

export function DeliverableUpload({
  keyValue,
  filename,
  onChange,
}: {
  keyValue: string | null;
  filename: string | null;
  onChange: (key: string | null, filename: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await upload(f, "deliverable");
      onChange(r.key ?? null, r.filename ?? f.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border border-line bg-panel px-3 py-2 text-xs">
        <span className="text-dim">private file:</span>
        <span className={keyValue ? "text-ok" : "text-dim"}>{keyValue ? filename || keyValue : "none"}</span>
      </div>
      <div className="flex gap-2">
        <input ref={input} type="file" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : keyValue ? "Replace file" : "Upload deliverable"}
        </button>
        {keyValue && (
          <button type="button" className="btn-sm text-blood" onClick={() => onChange(null, null)}>
            Remove
          </button>
        )}
      </div>
      {err && <div className="text-xs text-blood">! {err}</div>}
      <p className="text-[11px] text-dim">Stored in the private bucket. Buyers only ever get short-lived signed links.</p>
    </div>
  );
}
