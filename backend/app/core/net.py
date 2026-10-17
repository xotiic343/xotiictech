from fastapi import Request

from app.config import settings
from app.core.security import constant_time_equals


def client_ip(request: Request) -> str:
    """Resolve the real client IP.

    1. Requests relayed by our Next.js proxy carry `x-client-ip`, trusted only alongside the
       shared `x-proxy-secret`.
    2. Otherwise each trusted proxy appends to X-Forwarded-For, so the client is the entry
       `trusted_proxy_hops` positions from the right; entries further left are spoofable.
    """
    secret = settings.proxy_shared_secret
    if secret and constant_time_equals(request.headers.get("x-proxy-secret", ""), secret):
        relayed = request.headers.get("x-client-ip", "").strip()
        if relayed:
            return relayed[:64]
    hops = settings.trusted_proxy_hops
    xff = request.headers.get("x-forwarded-for")
    if hops > 0 and xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-hops] if len(parts) >= hops else parts[0]
    return request.client.host if request.client else "unknown"
