from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Enforce HTTPS behind Render's TLS terminator.
        if settings.is_production and request.headers.get("x-forwarded-proto") == "http":
            url = request.url.replace(scheme="https")
            return RedirectResponse(str(url), status_code=308)

        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if settings.is_production:
            h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        if request.url.path.startswith(("/api/admin", "/api/auth", "/api/account")):
            h["Cache-Control"] = "no-store"
        return response


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Rejects state-changing browser requests from foreign origins (defence in depth on top of
    SameSite cookies and the admin CSRF token). Server-to-server callers (Stripe) send no Origin."""

    EXEMPT_PREFIXES = ("/api/webhooks/",)

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("GET", "HEAD", "OPTIONS") and not request.url.path.startswith(self.EXEMPT_PREFIXES):
            origin = request.headers.get("origin")
            if origin and origin.rstrip("/") not in settings.allowed_origins:
                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        return await call_next(request)
