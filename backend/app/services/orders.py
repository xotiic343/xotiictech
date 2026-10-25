"""Checkout, fulfilment and download-link logic."""

import logging
import re
from datetime import datetime, timedelta, timezone

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import create_token, decode_token
from app.models import Order, Product, User
from app.services import site_settings
from app.services.email import notify_admin, send_email

log = logging.getLogger(__name__)
stripe.api_key = settings.stripe_secret_key


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    # SQLite drops tzinfo; treat naive datetimes as UTC.
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def create_checkout(db: Session, product: Product, email: str | None, user: User | None) -> tuple[Order, str]:
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe is not configured")
    order = Order(
        email=(email or (user.email if user else "")).lower(),
        user_id=user.id if user else None,
        product_id=product.id,
        product_name=product.name,
        amount_cents=product.price_cents,
        currency=product.currency or settings.currency,
        status="pending",
    )
    db.add(order)
    db.flush()

    frontend = settings.frontend_url.rstrip("/")
    params: dict = {
        "mode": "payment",
        "line_items": [
            {
                "quantity": 1,
                "price_data": {
                    "currency": order.currency,
                    "unit_amount": product.price_cents,
                    "product_data": {
                        "name": product.name,
                        "description": (product.tagline or "")[:500] or None,
                        "metadata": {"product_id": str(product.id)},
                    },
                },
            }
        ],
        "success_url": f"{frontend}/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{frontend}/store/{product.slug}?canceled=1",
        "metadata": {"order_id": order.public_id, "product_id": str(product.id)},
        "payment_intent_data": {"metadata": {"order_id": order.public_id}},
        "client_reference_id": order.public_id,
    }
    if order.email:
        params["customer_email"] = order.email
    # Strip None values Stripe would reject
    pd = params["line_items"][0]["price_data"]["product_data"]
    if pd["description"] is None:
        pd.pop("description")

    session = stripe.checkout.Session.create(**params)
    order.stripe_session_id = session.id
    db.commit()
    return order, session.url


def fulfil_checkout_session(db: Session, session: dict) -> Order | None:
    """Idempotently mark an order paid from a checkout.session.completed event."""
    order = db.scalar(select(Order).where(Order.stripe_session_id == session["id"]))
    if order is None:
        order_id = (session.get("metadata") or {}).get("order_id")
        if order_id:
            order = db.scalar(select(Order).where(Order.public_id == order_id))
    if order is None:
        log.error("Stripe session %s has no matching order", session.get("id"))
        return None
    if order.status == "paid":
        return order
    if session.get("payment_status") not in ("paid", "no_payment_required"):
        return order  # async payment still pending; checkout.session.async_payment_succeeded will follow

    email = ((session.get("customer_details") or {}).get("email") or order.email or "").lower()
    order.email = email
    order.status = "paid"
    order.paid_at = _now()
    order.stripe_payment_intent = session.get("payment_intent")
    order.amount_cents = session.get("amount_total") or order.amount_cents
    hours = int(site_settings.get_setting(db, "download_expiry_hours"))
    order.download_expires_at = _now() + timedelta(hours=hours)

    # Attach to (or create) a buyer account so they can sign in via magic link later.
    if email and order.user_id is None:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email)
            db.add(user)
            db.flush()
        order.user_id = user.id

    if order.product:
        order.product.sales_count = (order.product.sales_count or 0) + 1
        if order.product.sell_type == "hosted":
            order.hosting_status = "requested"
    db.commit()

    send_order_email(db, order)
    notify_admin(
        f"New order: {order.product_name}",
        f"{order.email} paid {order.amount_cents / 100:.2f} {order.currency.upper()} for {order.product_name}.",
    )
    return order


def mark_refunded(db: Session, payment_intent: str) -> None:
    order = db.scalar(select(Order).where(Order.stripe_payment_intent == payment_intent))
    if order and order.status != "refunded":
        order.status = "refunded"
        order.refund_notes = (order.refund_notes or "") + f"\nRefunded via Stripe at {_now().isoformat()}"
        db.commit()


def download_token(order: Order) -> str:
    expires = (_aware(order.download_expires_at) or _now()) - _now()
    return create_token(order.public_id, "download", max(expires, timedelta(seconds=1)))


def download_url(order: Order) -> str:
    return f"{settings.frontend_url.rstrip('/')}/api/downloads/{download_token(order)}"


def resolve_download(db: Session, token: str) -> tuple[Order | None, str | None]:
    """Returns (order, error)."""
    payload = decode_token(token, "download")
    if not payload:
        return None, "This download link is invalid or has expired."
    order = db.scalar(select(Order).where(Order.public_id == payload["sub"]))
    if order is None or order.status != "paid":
        return None, "This order is not available for download."
    if not order.download_expires_at or _aware(order.download_expires_at) < _now():
        return None, "This download link has expired. Sign in to your account for a fresh one."
    max_downloads = int(site_settings.get_setting(db, "max_downloads_per_order") or 0)
    if max_downloads and order.download_count >= max_downloads:
        return None, "Download limit reached for this order. Contact support."
    if not order.product or not order.product.has_download:
        return None, "This product has no downloadable file (hosted/custom products are delivered manually)."
    return order, None


def refresh_download_window(db: Session, order: Order) -> None:
    hours = int(site_settings.get_setting(db, "download_expiry_hours"))
    order.download_expires_at = _now() + timedelta(hours=hours)


def send_order_email(db: Session, order: Order) -> bool:
    has_file = bool(order.product and order.product.has_download)
    expires = _aware(order.download_expires_at)
    fmt = {
        "product": order.product_name,
        "link": download_url(order) if has_file else "(delivered manually — we'll be in touch shortly)",
        "expires": expires.strftime("%Y-%m-%d %H:%M UTC") if expires else "-",
        "account_url": f"{settings.frontend_url.rstrip('/')}/account",
    }
    subject = render_template(str(site_settings.get_setting(db, "email_order_subject")), fmt)
    body = render_template(str(site_settings.get_setting(db, "email_order_body")), fmt)
    ok = send_email(order.email, subject, body)
    if ok:
        order.last_emailed_at = _now()
        db.commit()
    return ok


_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def render_template(template: str, values: dict[str, str]) -> str:
    """Plain {name} substitution — no attribute access, unlike str.format."""
    return _PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), template)
