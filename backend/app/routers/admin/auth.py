from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import AdminContext, admin_ip_allowed, admin_password_version, require_admin
from app.core.ratelimit import limiter
from app.core.security import (
    ADMIN_COOKIE,
    CSRF_COOKIE,
    constant_time_equals,
    cookie_kwargs,
    create_token,
    random_token,
    verify_password,
    verify_totp,
)
from app.db import get_db
from app.schemas import AdminLoginIn
from app.services.audit import audit

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


@router.post("/login")
@limiter.limit("5/minute;20/hour")
def admin_login(
    request: Request,
    response: Response,
    body: AdminLoginIn,
    db: Session = Depends(get_db),
    ip: str = Depends(admin_ip_allowed),
):
    if not settings.admin_password_hash or not settings.admin_totp_secret:
        raise HTTPException(503, "Admin login is disabled: ADMIN_PASSWORD_HASH and ADMIN_TOTP_SECRET must be set")

    user_ok = constant_time_equals(body.username, settings.admin_username)
    pass_ok = verify_password(body.password, settings.admin_password_hash)  # always runs: constant-ish timing
    totp_ok = user_ok and pass_ok and verify_totp(body.totp, settings.admin_totp_secret)
    if not (user_ok and pass_ok and totp_ok):
        audit(db, body.username[:120] or "?", "admin.login_failed", details={"stage": "credentials" if not (user_ok and pass_ok) else "totp"}, ip=ip)
        db.commit()
        raise HTTPException(401, "Invalid credentials or 2FA code")

    max_age = settings.admin_session_hours * 3600
    token = create_token(
        settings.admin_username, "admin", timedelta(seconds=max_age), {"mfa": True, "pwv": admin_password_version()}
    )
    response.set_cookie(ADMIN_COOKIE, token, **cookie_kwargs(max_age, samesite="strict"))
    response.set_cookie(CSRF_COOKIE, random_token(24), **cookie_kwargs(max_age, httponly=False, samesite="strict"))
    audit(db, settings.admin_username, "admin.login", ip=ip)
    db.commit()
    return {"username": settings.admin_username, "expires_in": max_age}


@router.post("/logout")
def admin_logout(response: Response, admin: AdminContext = Depends(require_admin), db: Session = Depends(get_db)):
    response.delete_cookie(ADMIN_COOKIE, path="/", domain=settings.cookie_domain)
    response.delete_cookie(CSRF_COOKIE, path="/", domain=settings.cookie_domain)
    audit(db, admin.username, "admin.logout", ip=admin.ip)
    db.commit()
    return {"ok": True}


@router.get("/me")
def admin_me(admin: AdminContext = Depends(require_admin)):
    return {"username": admin.username}
