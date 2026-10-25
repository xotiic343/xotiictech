// Auth.js endpoints for /support: /support/api/auth/signin, /callback/discord, /signout, /session, ...
//
// Behind Render's proxy, Next.js sees the internal address (https://localhost:10000), so Auth.js would
// send Discord a redirect_uri on localhost and Discord rejects it ("Invalid OAuth2 redirect_uri").
// Rebuild the request URL from the public host Render forwards, so callbacks always use the real domain
// (xotiictech.net) without needing AUTH_URL / NEXTAUTH_URL set correctly.
import { NextRequest } from "next/server";
import { handlers } from "@/lib/support/auth";

async function withPublicUrl(req: NextRequest): Promise<NextRequest> {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  const local = !host || host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  const url = local ? new URL(req.url) : new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, `${proto}://${host}`);

  // Discord now appends an "iss" (issuer) parameter to the OAuth callback. Auth.js has no issuer configured
  // for Discord, so it compares against a placeholder and fails with 'unexpected "iss" response parameter
  // value'. The iss check only guards against mix-ups between several login providers; /support has one.
  if (url.pathname.endsWith("/callback/discord")) url.searchParams.delete("iss");
  if (local && url.href === req.url) return req;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new NextRequest(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });
}

export async function GET(req: NextRequest) {
  return handlers.GET(await withPublicUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(await withPublicUrl(req));
}
