import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

ALGORITHM = "HS256"
USER_COOKIE = "xt_session"
ADMIN_COOKIE = "xt_admin"
CSRF_COOKIE = "xt_csrf"
CSRF_HEADER = "x-csrf-token"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return pwd_context.verify(password, hashed)
    except (ValueError, TypeError):
        return False


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


# ---------- JWT ----------

def create_token(subject: str, token_type: str, expires: timedelta, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
        "jti": secrets.token_hex(8),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, token_type: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("typ") != token_type:
        return None
    return payload


# ---------- TOTP (admin 2FA) ----------

_last_totp_step: dict[str, int] = {}


def verify_totp(code: str, secret: str) -> bool:
    """Verify a 6-digit TOTP and reject replays of an already-used time step."""
    if not secret or not code or not code.isdigit():
        return False
    totp = pyotp.TOTP(secret)
    now = time.time()
    for drift in (-1, 0, 1):
        step = int(now // totp.interval) + drift
        if hmac.compare_digest(totp.at(step * totp.interval), code):
            if _last_totp_step.get(secret, -1) >= step:
                return False  # replay
            _last_totp_step[secret] = step
            return True
    return False


# ---------- cookies ----------

def cookie_kwargs(max_age: int, *, httponly: bool = True, samesite: str = "lax") -> dict[str, Any]:
    return {
        "max_age": max_age,
        "httponly": httponly,
        "secure": settings.cookie_secure,
        "samesite": samesite,
        "domain": settings.cookie_domain,
        "path": "/",
    }
