/** Base URL of the FastAPI service as seen from the Next.js server (never used in the browser). */
export function backendUrl(): string {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, "");
  if (process.env.BACKEND_HOSTPORT) return `http://${process.env.BACKEND_HOSTPORT}`;
  return "http://localhost:8000";
}

// During `next build` the API may be unreachable (e.g. Render's private network isn't available to builds).
// Fail fast so pages prerender empty and ISR fills them in on the first revalidation.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
const TIMEOUT_MS = IS_BUILD ? 4000 : 8000;

/** Server-side GET against the API with ISR caching. Returns null on any failure so pages still render. */
export async function apiGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${backendUrl()}/api${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
