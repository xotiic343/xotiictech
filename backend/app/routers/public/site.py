import hashlib
import re
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import distinct, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core.net import client_ip
from app.core.ratelimit import limiter
from app.core.security import ADMIN_COOKIE
from app.db import get_db
from app.models import (
    Bot,
    BotCommand,
    BotSyncLog,
    ContactMessage,
    NewsletterSubscriber,
    Order,
    PageView,
    Product,
    SecurityGuild,
    SecurityMember,
    Testimonial,
    User,
)
from app.schemas import ContactIn, NewsletterIn, PageViewIn
from app.serializers import iso, leaf_command_count, testimonial_out
from app.services import site_settings, storage
from app.services.email import notify_admin

router = APIRouter(tags=["site"])

# Non-human traffic that would otherwise inflate page views.
_BOT_UA = re.compile(
    r"bot|crawl|spider|slurp|preview|monitor|uptime|pingdom|headless|lighthouse|python|curl|wget|httpx|"
    r"axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|whatsapp|telegram|embedly|scrapy|semrush|ahrefs",
    re.IGNORECASE,
)
VIEW_DEDUPE = timedelta(minutes=30)


def _public_bots():
    return select(Bot).where(Bot.is_published.is_(True), Bot.is_hidden.is_(False))


def live_stats(db: Session) -> dict:
    bots = db.scalars(_public_bots()).all()
    bot_ids = [b.id for b in bots]
    # Count runnable commands (subcommands included), the same way the bot cards do.
    commands = (
        sum(
            leaf_command_count(c)
            for c in db.scalars(select(BotCommand).where(BotCommand.bot_id.in_(bot_ids), BotCommand.is_hidden.is_(False)))
        )
        if bot_ids
        else 0
    )
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)
    return {
        "products_sold": db.scalar(select(func.count(Order.id)).where(Order.status == "paid")) or 0,
        "bots_deployed": len(bots),
        "bots_online": sum(1 for b in bots if b.status == "online"),
        "servers_reached": sum(b.guild_count for b in bots),
        "total_commands": commands or 0,
        "clients": db.scalar(select(func.count(distinct(Order.email))).where(Order.status == "paid")) or 0,
        # Real, de-duplicated traffic (see page_view): distinct anonymous visitors per day, summed over 30 days.
        "visitors_30d": db.scalar(
            select(func.count()).select_from(
                select(PageView.visitor, func.date(PageView.created_at))
                .where(PageView.created_at >= since_30d, PageView.visitor.is_not(None))
                .distinct()
                .subquery()
            )
        ) or 0,
        "users": db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0,
        "protected_servers": db.scalar(select(func.count()).select_from(SecurityGuild)) or 0,
        "verified_members": db.scalar(
            select(func.count()).select_from(SecurityMember).where(SecurityMember.revoked.is_(False))
        ) or 0,
    }


@router.get("/health")
def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


@router.get("/site")
def site(db: Session = Depends(get_db)):
    content = site_settings.all_content(db)
    content.pop("legal", None)
    stats = live_stats(db)
    # Admin-entered stat values override live ones (leave null to show live numbers).
    for k, v in (content.get("stats") or {}).items():
        if v not in (None, ""):
            stats[k] = v

    start_of_day = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
    orders_today = db.scalar(
        select(func.count(Order.id)).where(Order.status == "paid", Order.paid_at >= start_of_day)
    ) or 0
    ticker = content.get("ticker") or {}
    live_items = [f"{orders_today} orders today"]
    if stats["bots_deployed"]:
        live_items.append(
            "All bots online"
            if stats["bots_online"] == stats["bots_deployed"]
            else f"{stats['bots_online']}/{stats['bots_deployed']} bots online"
        )
    ticker["live"] = live_items

    testimonials = db.scalars(
        select(Testimonial).where(Testimonial.is_published.is_(True)).order_by(Testimonial.sort_order, Testimonial.id)
    ).all()
    return {
        **content,
        "ticker": ticker,
        "stats": stats,
        "testimonials": [testimonial_out(t) for t in testimonials],
    }


@router.get("/legal/{page}")
def legal(page: str, db: Session = Depends(get_db)):
    legal = site_settings.get_content(db, "legal") or {}
    if page not in ("terms", "privacy", "refund_policy", "licenses"):
        raise HTTPException(404, "Not found")
    return {"page": page, "body": legal.get(page) or ""}


@router.get("/status")
def status(db: Session = Depends(get_db)):
    bots = db.scalars(_public_bots().order_by(Bot.sort_order, Bot.username)).all()
    last_sync = db.scalar(
        select(BotSyncLog).where(BotSyncLog.status != "running").order_by(BotSyncLog.started_at.desc()).limit(1)
    )
    return {
        "api": "operational",
        "store": "operational" if settings.stripe_secret_key else "degraded",
        "bots": [
            {"slug": b.slug, "name": b.name, "status": b.status, "avatar_url": b.avatar_url,
             "last_synced_at": iso(b.last_synced_at)}
            for b in bots
        ],
        "last_sync": {"status": last_sync.status, "finished_at": iso(last_sync.finished_at)} if last_sync else None,
    }


@router.post("/contact", status_code=201)
@limiter.limit("5/hour")
def contact(request: Request, body: ContactIn, db: Session = Depends(get_db)):
    if body.website:  # honeypot tripped: pretend success
        return {"ok": True}
    msg = ContactMessage(
        name=body.name, email=body.email, subject=body.subject, message=body.message, ip=client_ip(request)
    )
    db.add(msg)
    db.commit()
    notify_admin(f"[Contact] {body.subject}", f"From {body.name} <{body.email}>\n\n{body.message}", reply_to=body.email)
    return {"ok": True}


@router.post("/newsletter", status_code=201)
@limiter.limit("10/hour")
def newsletter(request: Request, body: NewsletterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    existing = db.scalar(select(NewsletterSubscriber).where(NewsletterSubscriber.email == email))
    if existing:
        existing.unsubscribed_at = None
    else:
        db.add(NewsletterSubscriber(email=email, source=body.source))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return {"ok": True}


def _visitor_id(request: Request) -> str:
    """Anonymous daily visitor id. Hash of secret + date + IP + user agent: no raw IP is kept, and it
    rotates every day."""
    day = datetime.now(timezone.utc).date().isoformat()
    raw = f"{settings.secret_key}:{day}:{client_ip(request)}:{request.headers.get('user-agent', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


@router.post("/analytics/view", status_code=204)
@limiter.limit("60/minute")
def page_view(request: Request, body: PageViewIn, db: Session = Depends(get_db)):
    """Counts real human page views only:
    - bots, crawlers, link previews and uptime checkers are ignored (user agent),
    - the signed-in admin is ignored (you browsing your own site),
    - the same visitor opening the same page again within 30 minutes counts once (refreshes, back/forward)."""
    ua = request.headers.get("user-agent", "")
    if not ua or _BOT_UA.search(ua) or request.cookies.get(ADMIN_COOKIE):
        return
    visitor = _visitor_id(request)
    path = body.path[:300]
    recent = db.scalar(
        select(PageView.id)
        .where(PageView.visitor == visitor, PageView.path == path, PageView.created_at >= datetime.now(timezone.utc) - VIEW_DEDUPE)
        .limit(1)
    )
    if recent:
        return
    view = PageView(path=path, referrer=(body.referrer or "")[:500] or None, visitor=visitor)
    parts = body.path.strip("/").split("/")
    if len(parts) == 2 and parts[0] in ("bots", "store"):
        model = Bot if parts[0] == "bots" else Product
        obj_id = db.scalar(select(model.id).where(model.slug == parts[1]))
        if parts[0] == "bots":
            view.bot_id = obj_id
        else:
            view.product_id = obj_id
    db.add(view)
    db.commit()


@router.get("/media/{key:path}")
def local_media(key: str):
    """Serves public media in local-storage dev mode. In production, media comes from R2's public domain."""
    if settings.storage_backend != "local":
        raise HTTPException(404, "Not found")
    try:
        path = storage.local_public_path(key)
    except ValueError:
        raise HTTPException(404, "Not found") from None
    if not path.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(path)
