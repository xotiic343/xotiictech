/** Base URL of the FastAPI service as seen from the Next.js server (never used in the browser). */
export function backendUrl(): string {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, "");
  if (process.env.BACKEND_HOSTPORT) return `http://${process.env.BACKEND_HOSTPORT}`;
  return "http://localhost:8000";
}

/** Server-side GET against the API with ISR caching. Returns null on any failure so pages still render. */
export async function apiGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${backendUrl()}/api${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
