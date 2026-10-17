from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.net import client_ip
from app.core.security import (
    ADMIN_COOKIE,
    CSRF_COOKIE,
    CSRF_HEADER,
    USER_COOKIE,
    constant_time_equals,
    decode_token,
    sha256_hex,
)
from app.db import get_db
from app.models import User

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def verify_csrf(request: Request) -> None:
    """Double-submit cookie check for state-changing requests."""
    if request.method in SAFE_METHODS:
        return
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or not constant_time_equals(cookie, header):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF check failed")


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(USER_COOKIE)
    if not token:
        return None
    payload = decode_token(token, "user")
    if not payload:
        return None
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        return None
    return user


def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


@dataclass
class AdminContext:
    username: str
    ip: str


def admin_password_version() -> str:
    return sha256_hex(settings.admin_password_hash)[:16]


def admin_ip_allowed(request: Request) -> str:
    ip = client_ip(request)
    allow = settings.admin_ips
    if allow and ip not in allow:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return ip


def require_admin(request: Request, ip: str = Depends(admin_ip_allowed)) -> AdminContext:
    token = request.cookies.get(ADMIN_COOKIE)
    payload = decode_token(token, "admin") if token else None
    if not payload or not payload.get("mfa"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin session required")
    # Sessions die automatically when the admin username or password hash is rotated.
    if payload.get("sub") != settings.admin_username or payload.get("pwv") != admin_password_version():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin session required")
    verify_csrf(request)
    return AdminContext(username=payload["sub"], ip=ip)
