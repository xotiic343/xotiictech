// Browser-only helpers (used from client components).

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Browser → same-origin /api proxy. Attaches the admin CSRF token when present. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  if (json !== undefined) h.set("content-type", "application/json");
  const csrf = readCookie("xt_csrf");
  if (csrf) h.set("x-csrf-token", csrf);

  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fields: Record<string, string> = {};
    for (const e of (data?.errors ?? []) as { field: string; message: string }[]) fields[e.field] = e.message;
    const msg =
      typeof data?.detail === "string"
        ? data.detail + (Object.keys(fields).length ? `: ${Object.entries(fields).map(([k, v]) => `${k} — ${v}`).join("; ")}` : "")
        : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, fields);
  }
  return data as T;
}
