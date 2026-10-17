import logging
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user_optional
from app.core.ratelimit import limiter
from app.db import get_db
from app.models import Order, Product, User
from app.schemas import CheckoutIn
from app.serializers import product_card, product_detail
from app.services import orders as order_service
from app.services import storage

log = logging.getLogger(__name__)
router = APIRouter(tags=["store"])

CATEGORY_LABELS = {
    "source_code": "Source Code",
    "discord_bots": "Discord Bots",
    "minecraft_clients": "Minecraft Clients",
    "pc_applications": "PC Applications",
}


@router.get("/products")
def list_products(
    db: Session = Depends(get_db),
    category: str | None = Query(None, max_length=40),
    q: str | None = Query(None, max_length=100),
    featured: bool = False,
    sort: Literal["featured", "newest", "price_asc", "price_desc", "popular", "name"] = "featured",
):
    stmt = select(Product).where(Product.is_published.is_(True))
    if category:
        stmt = stmt.where(Product.category == category)
    if featured:
        stmt = stmt.where(Product.is_featured.is_(True))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.tagline.ilike(like), Product.description.ilike(like)))
    order = {
        "featured": (Product.is_featured.desc(), Product.sort_order, Product.created_at.desc()),
        "newest": (Product.created_at.desc(),),
        "price_asc": (Product.price_cents.asc(),),
        "price_desc": (Product.price_cents.desc(),),
        "popular": (Product.sales_count.desc(),),
        "name": (Product.name.asc(),),
    }[sort]
    items = db.scalars(stmt.order_by(*order)).unique().all()
    return {
        "items": [product_card(p) for p in items],
        "categories": [{"value": k, "label": v} for k, v in CATEGORY_LABELS.items()],
    }


@router.get("/products/{slug}")
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Product).where(Product.slug == slug, Product.is_published.is_(True)))
    if not p:
        raise HTTPException(404, "Product not found")
    return product_detail(p)


@router.post("/checkout/session")
@limiter.limit("10/minute")
def checkout(
    request: Request,
    body: CheckoutIn,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    product = db.scalar(select(Product).where(Product.slug == body.product_slug, Product.is_published.is_(True)))
    if not product:
        raise HTTPException(404, "Product not found")
    if product.price_cents < 50:
        raise HTTPException(400, "This product is free or not purchasable online")
    if product.sell_type == "custom_build":
        raise HTTPException(400, "Custom builds are quoted individually — use the commission form")
    try:
        _, url = order_service.create_checkout(db, product, body.email, user)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from None
    except stripe.StripeError:
        log.exception("Stripe checkout failed")
        raise HTTPException(502, "Payment provider error, please try again") from None
    return {"url": url}


@router.get("/checkout/session/{session_id}")
@limiter.limit("30/minute")
def checkout_result(request: Request, session_id: str, db: Session = Depends(get_db)):
    if not session_id.startswith("cs_") or len(session_id) > 255:
        raise HTTPException(404, "Not found")
    order = db.scalar(select(Order).where(Order.stripe_session_id == session_id))
    if not order:
        raise HTTPException(404, "Not found")
    # Webhook may lag behind the redirect; reconcile directly with Stripe once.
    if order.status == "pending" and settings.stripe_secret_key:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session.get("payment_status") == "paid":
                order_service.fulfil_checkout_session(db, session.to_dict())
                db.refresh(order)
        except stripe.StripeError:
            log.warning("Could not reconcile checkout session")
    has_file = bool(order.product and order.product.deliverable_key)
    return {
        "status": order.status,
        "product_name": order.product_name,
        "product_slug": order.product.slug if order.product else None,
        "email": order.email,
        "is_hosted": bool(order.product and order.product.sell_type == "hosted"),
        "download_url": order_service.download_url(order) if order.status == "paid" and has_file else None,
        "download_expires_at": order.download_expires_at.isoformat() if order.download_expires_at else None,
    }


@router.get("/downloads/{token}")
@limiter.limit("30/minute")
def download(request: Request, token: str, db: Session = Depends(get_db)):
    order, error = order_service.resolve_download(db, token)
    if error or order is None:
        return HTMLResponse(
            _download_error_page(error or "Unavailable"),
            status_code=410,
            headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"},
        )
    product = order.product
    order.download_count += 1
    db.commit()
    url = storage.private_download_url(product.deliverable_key, product.deliverable_filename or "download")
    if url:
        return RedirectResponse(url, status_code=302)
    path = storage.local_private_path(product.deliverable_key)
    if not path.is_file():
        raise HTTPException(404, "File missing")
    return FileResponse(path, filename=product.deliverable_filename or path.name)


@router.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Webhook not configured")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(400, "Invalid signature") from None

    etype = event["type"]
    obj = event["data"]["object"]
    obj = obj.to_dict() if hasattr(obj, "to_dict") else obj
    if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        order_service.fulfil_checkout_session(db, obj)
    elif etype in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        order = db.scalar(select(Order).where(Order.stripe_session_id == obj["id"]))
        if order and order.status == "pending":
            order.status = "failed"
            db.commit()
    elif etype == "charge.refunded":
        if obj.get("payment_intent"):
            order_service.mark_refunded(db, obj["payment_intent"])
    return {"received": True}


def _download_error_page(message: str) -> str:
    from html import escape

    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Download unavailable</title>
<style>body{{background:#000;color:#ddd;font-family:monospace;display:grid;place-items:center;min-height:100vh;margin:0}}
.box{{border:1px solid #e60000;padding:2rem;max-width:32rem;box-shadow:0 0 24px #e6000055}}
a{{color:#ff0033}}</style></head><body><div class="box"><h1 style="color:#ff0033">// DOWNLOAD UNAVAILABLE</h1>
<p>{escape(message)}</p><p><a href="{escape(settings.frontend_url)}/account">Go to your account →</a></p></div></body></html>"""
