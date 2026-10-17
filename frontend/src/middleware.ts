import { NextResponse, type NextRequest } from "next/server";

/**
 * UX guard only: bounces visitors without an admin session cookie to the login screen.
 * Real authorization (JWT + TOTP + CSRF + IP allowlist) is enforced by FastAPI on every /api/admin call.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/xotiic") && pathname !== "/xotiic/login" && !req.cookies.get("xt_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/xotiic/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/xotiic/:path*"] };
