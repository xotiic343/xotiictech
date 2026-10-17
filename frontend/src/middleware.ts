import { NextResponse, type NextRequest } from "next/server";

function clientIp(req: NextRequest): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("true-client-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/* is proxied to FastAPI by the rewrite in next.config.mjs. Here we stamp the visitor's IP
  // (plus the shared secret that proves it came from us) onto the proxied request for rate limiting.
  if (pathname.startsWith("/api/")) {
    const headers = new Headers(req.headers);
    headers.delete("x-proxy-secret");
    headers.delete("x-client-ip");
    const secret = process.env.PROXY_SHARED_SECRET;
    if (secret) {
      headers.set("x-proxy-secret", secret);
      headers.set("x-client-ip", clientIp(req));
    }
    return NextResponse.next({ request: { headers } });
  }

  // UX guard only: real admin authorization (JWT + TOTP + CSRF + IP allowlist) is enforced by FastAPI.
  if (pathname.startsWith("/xotiic") && pathname !== "/xotiic/login" && !req.cookies.get("xt_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/xotiic/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/xotiic/:path*"],
  runtime: "nodejs", // read PROXY_SHARED_SECRET from the real runtime environment
};
