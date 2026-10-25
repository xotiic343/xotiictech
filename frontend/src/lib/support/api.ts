// JSON helpers and request guards shared by the /support/api route handlers.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "./env";

export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * CSRF guard for browser-facing POST routes: the Origin must be this same host, and the body must be
 * JSON (a cross-site page can't send that without a CORS preflight, which we never approve).
 * Compared against the request's own host, so it works on both the Render URL and the custom domain.
 */
export function assertSameOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !host || originHost !== host.split(",")[0].trim()) {
    return apiError(403, "forbidden", "Cross-origin request blocked.");
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return apiError(415, "unsupported_media_type", "Send JSON.");
  }
  return null;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** For requests FROM the Ticket X bot: "Authorization: Bearer <BOT_HEARTBEAT_SECRET>". Constant-time. */
export function isBotRequest(req: Request): boolean {
  const secret = env().BOT_HEARTBEAT_SECRET;
  if (!secret) return false;
  const match = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "");
  return !!match && timingSafeEqual(digest(match[1]), digest(secret));
}
