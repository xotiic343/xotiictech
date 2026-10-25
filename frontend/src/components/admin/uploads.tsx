"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Media } from "@/lib/types";

type Kind = "media" | "deliverable";
type UploadResult = { url?: string; key?: string; filename?: string; type?: "image" | "video"; size?: number };
export type Progress = { name: string; loaded: number; total: number };

const CONCURRENCY = 4; // parts uploading at the same time
const RETRIES = 3; // attempts per part before giving up
const SIGN_BATCH = 50; // presigned URLs requested per call

/**
 * Upload a file of any size. In production the API hands out presigned URLs and the browser PUTs the file
 * straight to the storage bucket in parts (never through the website or API), so big videos and zips work.
 * On the local dev backend it falls back to the original single request.
 */
async function uploadFile(file: File, kind: Kind, onProgress: (loaded: number) => void): Promise<UploadResult> {
  const contentType = file.type || (kind === "media" ? guessMediaType(file.name) : "application/octet-stream");
  const start = await api<{ mode: "simple" | "multipart"; token?: string; part_size?: number; parts?: number }>("/admin/uploads/start", {
    method: "POST",
    json: { kind, filename: file.name, content_type: contentType, size: file.size },
  });

  if (start.mode === "simple") {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const r = await api<UploadResult>("/admin/uploads", { method: "POST", body: fd });
    onProgress(file.size);
    return r;
  }

  const token = start.token!;
  const partSize = start.part_size!;
  const total = start.parts!;
  const done = new Map<number, number>(); // part -> bytes finished
  const inFlight = new Map<number, number>(); // part -> bytes sent so far
  const report = () => onProgress([...done.values(), ...inFlight.values()].reduce((a, b) => a + b, 0));

  try {
    for (let first = 1; first <= total; first += SIGN_BATCH) {
      const numbers = Array.from({ length: Math.min(SIGN_BATCH, total - first + 1) }, (_, i) => first + i);
      const { urls } = await api<{ urls: Record<string, string> }>("/admin/uploads/sign", { method: "POST", json: { token, part_numbers: numbers } });

      const queue = [...numbers];
      const worker = async () => {
        for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
          const blob = file.slice((n - 1) * partSize, Math.min(n * partSize, file.size));
          await putWithRetry(urls[String(n)], blob, (sent) => {
            inFlight.set(n, sent);
            report();
          });
          inFlight.delete(n);
          done.set(n, blob.size);
          report();
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, numbers.length) }, worker));
    }
    return await api<UploadResult>("/admin/uploads/complete", { method: "POST", json: { token } });
  } catch (e) {
    // Best effort: free the half-uploaded parts in the bucket.
    api("/admin/uploads/abort", { method: "POST", json: { token } }).catch(() => undefined);
    throw e;
  }
}

async function putWithRetry(url: string, blob: Blob, onSent: (bytes: number) => void) {
  let last: Error | null = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      return await put(url, blob, onSent);
    } catch (e) {
      last = e as Error;
      onSent(0);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw last ?? new Error("Upload failed");
}

/** XHR (not fetch) so we get upload progress events. No headers: the presigned URL carries the auth. */
function put(url: string, blob: Blob, onSent: (bytes: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onSent(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 || xhr.status === 400 ? "Storage rejected the file (check your bucket's file size limit)" : `Storage error ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Upload blocked: check the storage bucket's CORS settings (docs/STORAGE_SETUP.md)"));
    xhr.send(blob);
  });
}

function guessMediaType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as Record<string, string>)[ext ?? ""] ?? "";
}

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function ProgressBar({ p }: { p: Progress }) {
  const pct = p.total ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0;
  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="flex justify-between text-[11px] text-muted">
        <span className="truncate pr-2">{p.name}</span>
        <span className="shrink-0 tabular-nums">
          {pct}% · {fmtBytes(p.loaded)} / {fmtBytes(p.total)}
        </span>
      </div>
      <div className="h-1.5 bg-line">
        <div className="h-full bg-crimson shadow-[0_0_8px_rgba(230,0,0,.6)] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Ordered list of images/videos with upload, URL add, reorder and remove. */
export function MediaEditor({ value, onChange }: { value: Media[]; onChange: (m: Media[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const busy = progress !== null;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    const added: Media[] = [];
    try {
      for (const f of Array.from(files)) {
        setProgress({ name: f.name, loaded: 0, total: f.size });
        const r = await uploadFile(f, "media", (loaded) => setProgress({ name: f.name, loaded, total: f.size }));
        if (r.url) added.push({ type: r.type ?? "image", url: r.url, alt: "" });
      }
      onChange([...value, ...added]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      if (added.length) onChange([...value, ...added]);
    } finally {
      setProgress(null);
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
              <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" />
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
      {progress && <ProgressBar p={progress} />}
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "+ Upload media"}
        </button>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an https:// URL" className="input flex-1 py-1.5 text-xs" />
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            if (!/^https?:\/\//.test(url)) return setErr("URL must start with https://");
            onChange([...value, { type: /\.(mp4|webm|mov)$/i.test(url) ? "video" : "image", url, alt: "" }]);
            setUrl("");
          }}
        >
          Add URL
        </button>
      </div>
      <p className="text-[11px] text-dim">Images and videos (MP4, WebM, MOV), long videos included. Large files upload in parts straight to storage.</p>
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
  const [progress, setProgress] = useState<Progress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const busy = progress !== null;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null);
    setProgress({ name: f.name, loaded: 0, total: f.size });
    try {
      const r = await uploadFile(f, "deliverable", (loaded) => setProgress({ name: f.name, loaded, total: f.size }));
      onChange(r.key ?? null, r.filename ?? f.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border border-line bg-panel px-3 py-2 text-xs">
        <span className="text-dim">private file:</span>
        <span className={keyValue ? "text-ok" : "text-dim"}>{keyValue ? filename || keyValue : "none"}</span>
      </div>
      {progress && <ProgressBar p={progress} />}
      <div className="flex gap-2">
        <input ref={input} type="file" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : keyValue ? "Replace file" : "Upload deliverable"}
        </button>
        {keyValue && !busy && (
          <button type="button" className="btn-sm text-blood" onClick={() => onChange(null, null)}>
            Remove
          </button>
        )}
      </div>
      {err && <div className="text-xs text-blood">! {err}</div>}
      <p className="text-[11px] text-dim">
        Zips, installers and other big files (up to 50 GB by default). Stored in the private bucket; buyers only get short-lived signed links.
      </p>
    </div>
  );
}
