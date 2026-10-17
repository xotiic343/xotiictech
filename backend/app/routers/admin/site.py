"""Dashboard, analytics, site content, settings, users, newsletter, audit log."""

import csv
import io
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import AdminContext, require_admin
from app.db import get_db
from app.models import (
    AuditLog,
    Bot,
    BotInquiry,
    ContactMessage,
    NewsletterSubscriber,
    Order,
    PageView,
    Product,
    User,
)
from app.routers.public.site import live_stats
from app.schemas import ContentIn, SettingsIn, _url_or_empty
from app.serializers import columns, iso
from app.services import scheduler, site_settings
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin-site"])


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    paid = select(Order).where(Order.status == "paid")
    revenue_by_currency = dict(
        db.execute(select(Order.currency, func.sum(Order.amount_cents)).where(Order.status == "paid").group_by(Order.currency)).all()
    )
    return {
        "stats": live_stats(db),
        "revenue_cents": revenue_by_currency,
        "orders_30d": db.scalar(select(func.count()).select_from(paid.where(Order.paid_at >= _since(30)).subquery())),
        "views_30d": db.scalar(select(func.count(PageView.id)).where(PageView.created_at >= _since(30))),
        "unpublished_bots": db.scalar(select(func.count(Bot.id)).where(Bot.is_published.is_(False), Bot.is_hidden.is_(False))),
        "new_inquiries": db.scalar(select(func.count(BotInquiry.id)).where(BotInquiry.status == "new")),
        "new_messages": db.scalar(select(func.count(ContactMessage.id)).where(ContactMessage.status == "new")),
        "hosting_requests": db.scalar(select(func.count(Order.id)).where(Order.hosting_status == "requested")),
        "recent_orders": [
            {"id": o.id, "email": o.email, "product_name": o.product_name, "amount_cents": o.amount_cents,
             "currency": o.currency, "status": o.status, "created_at": iso(o.created_at)}
            for o in db.scalars(select(Order).order_by(Order.created_at.desc()).limit(8)).unique()
        ],
        "stripe_mode": "live" if settings.stripe_secret_key.startswith("sk_live") else "test",
    }


@router.get("/analytics")
def analytics(
    db: Session = Depends(get_db), _: AdminContext = Depends(require_admin), days: int = Query(30, ge=1, le=365)
):
    since = _since(days)
    views = db.scalars(select(PageView.created_at).where(PageView.created_at >= since)).all()
    orders = db.scalars(select(Order).where(Order.status == "paid", Order.paid_at >= since)).unique().all()

    by_day: dict[str, dict] = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).date().isoformat()
        by_day[d] = {"date": d, "views": 0, "sales": 0, "revenue_cents": 0}
    for ts in views:
        d = ts.date().isoformat()
        if d in by_day:
            by_day[d]["views"] += 1
    for o in orders:
        d = o.paid_at.date().isoformat()
        if d in by_day:
            by_day[d]["sales"] += 1
            by_day[d]["revenue_cents"] += o.amount_cents

    top_products = db.execute(
        select(Order.product_name, func.count(Order.id), func.sum(Order.amount_cents))
        .where(Order.status == "paid", Order.paid_at >= since)
        .group_by(Order.product_name)
        .order_by(func.count(Order.id).desc())
        .limit(10)
    ).all()
    top_bots = db.execute(
        select(Bot.username, Bot.display_name, Bot.slug, func.count(PageView.id))
        .join(PageView, PageView.bot_id == Bot.id)
        .where(PageView.created_at >= since)
        .group_by(Bot.id, Bot.username, Bot.display_name, Bot.slug)
        .order_by(func.count(PageView.id).desc())
        .limit(10)
    ).all()
    top_pages = db.execute(
        select(PageView.path, func.count(PageView.id))
        .where(PageView.created_at >= since)
        .group_by(PageView.path)
        .order_by(func.count(PageView.id).desc())
        .limit(15)
    ).all()
    return {
        "days": list(by_day.values()),
        "totals": {
            "views": len(views),
            "sales": len(orders),
            "revenue_cents": sum(o.amount_cents for o in orders),
        },
        "top_products": [{"name": n, "sales": c, "revenue_cents": r or 0} for n, c, r in top_products],
        "top_bots": [{"name": dn or u, "slug": s, "views": c} for u, dn, s, c in top_bots],
        "top_pages": [{"path": p, "views": c} for p, c in top_pages],
    }


# ---------------- site content ----------------


def _validate_content(key: str, value) -> None:
    default = site_settings.CONTENT_DEFAULTS.get(key)
    if default is None:
        raise HTTPException(404, f"Unknown content block '{key}'")
    if type(value) is not type(default):
        raise HTTPException(422, f"'{key}' must be a {type(default).__name__}")
    if len(json.dumps(value)) > 200_000:
        raise HTTPException(413, "Content block too large")
    if key == "free_tools":
        for item in value.get("items", []):
            if not isinstance(item, dict) or not item.get("name") or not item.get("url"):
                raise HTTPException(422, "Each free tool needs a name and url")
            try:
                _url_or_empty(item["url"])
            except ValueError:
                raise HTTPException(422, f"Invalid URL: {item['url']}") from None


@router.get("/content")
def get_content(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    return site_settings.all_content(db)


@router.put("/content/{key}")
def put_content(key: str, body: ContentIn, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    _validate_content(key, body.value)
    site_settings.set_content(db, key, body.value)
    audit(db, admin.username, "content.update", "content", key, ip=admin.ip)
    db.commit()
    return {"key": key, "value": site_settings.get_content(db, key)}


# ---------------- settings ----------------


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    pk = settings.stripe_publishable_key
    return {
        "values": site_settings.all_settings(db),
        "readonly": {
            "stripe_mode": "live" if settings.stripe_secret_key.startswith("sk_live") else "test",
            "stripe_publishable_key": (pk[:12] + "…" + pk[-4:]) if len(pk) > 16 else pk,
            "stripe_webhook_configured": bool(settings.stripe_webhook_secret),
            "email_configured": bool(settings.resend_api_key),
            "storage_backend": settings.storage_backend,
            "discord_tokens_configured": len(settings.discord_tokens),
            "admin_ip_allowlist": bool(settings.admin_ips),
        },
    }


@router.put("/settings")
def put_settings(body: SettingsIn, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for k, v in changes.items():
        site_settings.set_setting(db, k, v)
    audit(db, admin.username, "settings.update", "settings", None, {"fields": sorted(changes)}, ip=admin.ip)
    db.commit()
    if "discord_sync_interval_minutes" in changes:
        scheduler.reschedule(int(changes["discord_sync_interval_minutes"]))
    return {"values": site_settings.all_settings(db)}


# ---------------- people ----------------


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    order_counts = dict(
        db.execute(select(Order.user_id, func.count(Order.id)).where(Order.status == "paid").group_by(Order.user_id)).all()
    )
    users = db.scalars(select(User).order_by(User.created_at.desc()).limit(1000)).all()
    return {
        "items": [
            {**columns(u, exclude={"password_hash"}), "has_password": bool(u.password_hash),
             "orders": order_counts.get(u.id, 0)}
            for u in users
        ]
    }


@router.get("/newsletter")
def list_subscribers(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    rows = db.scalars(select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())).all()
    return {"items": [columns(r) for r in rows]}


@router.get("/newsletter.csv")
def export_subscribers(db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    rows = db.scalars(
        select(NewsletterSubscriber).where(NewsletterSubscriber.unsubscribed_at.is_(None)).order_by(NewsletterSubscriber.created_at)
    ).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["email", "source", "subscribed_at"])
    for r in rows:
        w.writerow([r.email, r.source or "", iso(r.created_at)])
    audit(db, admin.username, "newsletter.export", ip=admin.ip)
    db.commit()
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=newsletter.csv"},
    )


@router.get("/audit-logs")
def audit_logs(
    db: Session = Depends(get_db),
    _: AdminContext = Depends(require_admin),
    action: str | None = Query(None, max_length=80),
    limit: int = Query(200, ge=1, le=1000),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    return {"items": [columns(a) for a in db.scalars(stmt).all()]}


@router.get("/options/bots")
def bot_options(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    """Small lookup used by the product editor's 'link to bot' select."""
    return {"items": [{"id": b.id, "name": b.name, "slug": b.slug} for b in db.scalars(select(Bot).order_by(Bot.username))]}


@router.get("/options/products")
def product_options(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    return {"items": [{"id": p.id, "name": p.name, "slug": p.slug} for p in db.scalars(select(Product).order_by(Product.name)).unique()]}
