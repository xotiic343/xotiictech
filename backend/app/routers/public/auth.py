"""Buyer accounts.

Accounts are created automatically at purchase (keyed by the checkout email) and accessed via
magic link. Once signed in, a buyer may set a password for faster logins. There is deliberately
no open password registration: it would let someone pre-claim another person's email and see
their future orders.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user
from app.core.ratelimit import limiter
from app.core.security import (
    USER_COOKIE,
    cookie_kwargs,
    create_token,
    hash_password,
    random_token,
    sha256_hex,
    verify_password,
)
from app.db import get_db
from app.models import MagicLinkToken, Order, User
from app.schemas import HostingRequestIn, LoginIn, MagicLinkIn, MagicVerifyIn, PasswordSetIn
from app.serializers import order_buyer
from app.services import orders as order_service
from app.services import site_settings
from app.services.email import notify_admin, send_email

router = APIRouter(tags=["account"])

_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _start_session(response: Response, user: User) -> None:
    max_age = settings.user_session_days * 86400
    token = create_token(str(user.id), "user", timedelta(seconds=max_age))
    response.set_cookie(USER_COOKIE, token, **cookie_kwargs(max_age, samesite="lax"))


def _user_out(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "has_password": bool(user.password_hash)}


@router.post("/auth/login")
@limiter.limit("10/minute")
def login(request: Request, response: Response, body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user and user.password_hash else _DUMMY_HASH)
    if not user or not user.password_hash or not ok or not user.is_active:
        raise HTTPException(401, "Invalid email or password")
    user.last_login_at = _now()
    db.commit()
    _start_session(response, user)
    return _user_out(user)


@router.post("/auth/magic-link")
@limiter.limit("5/15minutes")
def magic_link(request: Request, body: MagicLinkIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user and user.is_active:
        raw = random_token(32)
        db.add(MagicLinkToken(user_id=user.id, token_hash=sha256_hex(raw), expires_at=_now() + timedelta(minutes=15)))
        db.commit()
        link = f"{settings.frontend_url.rstrip('/')}/account/verify?token={raw}"
        send_email(
            user.email,
            str(site_settings.get_setting(db, "email_magic_link_subject")),
            f"Sign in to XotiicTech:\n\n{link}\n\nThis link expires in 15 minutes and works once.\n"
            "If you didn't request it, ignore this email.",
        )
    # Same response either way — don't reveal which emails have accounts.
    return {"ok": True, "message": "If that email has purchases, a sign-in link is on its way."}


@router.post("/auth/magic-link/verify")
@limiter.limit("10/minute")
def magic_verify(request: Request, response: Response, body: MagicVerifyIn, db: Session = Depends(get_db)):
    row = db.scalar(select(MagicLinkToken).where(MagicLinkToken.token_hash == sha256_hex(body.token)))
    if not row or row.used_at or _aware(row.expires_at) < _now():
        raise HTTPException(400, "This sign-in link is invalid or expired")
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        raise HTTPException(400, "This sign-in link is invalid or expired")
    row.used_at = _now()
    user.last_login_at = _now()
    db.commit()
    _start_session(response, user)
    return _user_out(user)


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(USER_COOKIE, path="/", domain=settings.cookie_domain)
    return {"ok": True}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.post("/account/password")
@limiter.limit("5/minute")
def set_password(request: Request, body: PasswordSetIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if user.password_hash and not verify_password(body.current_password or "", user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    if body.name is not None:
        user.name = body.name or None
    db.commit()
    return _user_out(user)


@router.get("/account/orders")
def my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    orders = db.scalars(
        select(Order)
        .where((Order.user_id == user.id) | (Order.email == user.email), Order.status.in_(["paid", "refunded"]))
        .order_by(Order.created_at.desc())
    ).all()
    return {"items": [order_buyer(o) for o in orders]}


def _own_order(db: Session, user: User, order_id: str) -> Order:
    order = db.scalar(select(Order).where(Order.public_id == order_id))
    if not order or (order.user_id != user.id and order.email != user.email):
        raise HTTPException(404, "Order not found")
    return order


@router.post("/account/orders/{order_id}/download-link")
@limiter.limit("20/hour")
def fresh_download_link(request: Request, order_id: str, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    order = _own_order(db, user, order_id)
    if order.status != "paid":
        raise HTTPException(400, "Order is not paid")
    if not order.product or not order.product.has_download:
        raise HTTPException(400, "This product has no downloadable file")
    # A signed-in buyer can always re-download: re-open the window from now.
    order_service.refresh_download_window(db, order)
    db.commit()
    return {"url": order_service.download_url(order), "expires_at": order.download_expires_at.isoformat()}


@router.post("/account/orders/{order_id}/hosting")
@limiter.limit("10/hour")
def request_hosting(request: Request, order_id: str, body: HostingRequestIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    order = _own_order(db, user, order_id)
    if order.status != "paid" or not order.product or order.product.sell_type != "hosted":
        raise HTTPException(400, "This order is not a hosted bot")
    if order.hosting_status in ("approved", "deployed"):
        raise HTTPException(409, "Hosting is already approved — contact support to change servers")
    order.hosting_server_id = body.server_id
    order.hosting_status = "requested"
    db.commit()
    notify_admin(
        f"[Hosting] {order.product_name}",
        f"{order.email} requested hosting on server {body.server_id} (order {order.public_id}).",
    )
    return order_buyer(order)
