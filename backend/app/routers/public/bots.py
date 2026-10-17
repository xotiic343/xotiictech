from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.core.net import client_ip
from app.core.ratelimit import limiter
from app.db import get_db
from app.models import Bot, BotInquiry, Order, Product, Review, User
from app.schemas import CommissionIn, ReviewIn
from app.serializers import bot_card, bot_detail
from app.services import site_settings
from app.services.email import notify_admin
from app.routers.public.site import live_stats

router = APIRouter(prefix="/bots", tags=["bots"])


def _published():
    return (
        select(Bot)
        .where(Bot.is_published.is_(True), Bot.is_hidden.is_(False))
        .options(selectinload(Bot.commands))
    )


@router.get("")
def list_bots(
    db: Session = Depends(get_db),
    tag: str | None = Query(None, max_length=40),
    category: str | None = Query(None, max_length=60),
    sort: Literal["servers", "name", "newest", "featured"] = "featured",
):
    all_bots = db.scalars(_published()).all()
    all_tags = sorted({t for b in all_bots for t in b.effective_tags})
    categories = sorted({b.category for b in all_bots if b.category})
    bots = list(all_bots)
    if tag:
        bots = [b for b in bots if tag.lower() in (t.lower() for t in b.effective_tags)]
    if category:
        bots = [b for b in bots if (b.category or "").lower() == category.lower()]
    key = {
        "servers": lambda b: -b.guild_count,
        "name": lambda b: b.name.lower(),
        "newest": lambda b: -(b.published_at or b.first_seen_at).timestamp(),
        "featured": lambda b: (not b.is_featured, b.sort_order, -b.guild_count),
    }[sort]
    bots.sort(key=key)
    return {"items": [bot_card(b) for b in bots], "tags": all_tags, "categories": categories}


@router.get("/stats")
def bot_stats(db: Session = Depends(get_db)):
    s = live_stats(db)
    return {
        "total_bots": s["bots_deployed"],
        "bots_online": s["bots_online"],
        "total_servers": s["servers_reached"],
        "total_commands": s["total_commands"],
    }


@router.post("/inquiries", status_code=201)
@limiter.limit("3/hour")
def commission(request: Request, body: CommissionIn, db: Session = Depends(get_db)):
    if body.website:
        return {"ok": True}
    ref_id = None
    if body.reference_bot:
        ref_id = db.scalar(select(Bot.id).where(Bot.slug == body.reference_bot))
    inquiry = BotInquiry(
        discord_username=body.discord_username,
        email=body.email,
        server_size=body.server_size,
        purpose=body.purpose,
        features=body.features,
        budget=body.budget,
        timeline=body.timeline,
        reference_bot_id=ref_id,
        ip=client_ip(request),
    )
    db.add(inquiry)
    db.commit()
    notify_admin(
        f"[Commission] {body.discord_username} — {body.budget}",
        f"Discord: {body.discord_username}\nEmail: {body.email}\nServer size: {body.server_size}\n"
        f"Budget: {body.budget}\nTimeline: {body.timeline}\n\nPurpose:\n{body.purpose}\n\nFeatures:\n{body.features}",
        reply_to=body.email,
    )
    return {"ok": True, "id": inquiry.id}


@router.get("/{slug}")
def get_bot(slug: str, db: Session = Depends(get_db)):
    bot = db.scalar(_published().where(Bot.slug == slug))
    if not bot:
        raise HTTPException(404, "Bot not found")
    product = db.scalar(
        select(Product).where(Product.bot_id == bot.id, Product.is_published.is_(True)).order_by(Product.sort_order)
    )
    reviews = db.scalars(
        select(Review).where(Review.bot_id == bot.id, Review.is_approved.is_(True)).order_by(Review.created_at.desc())
    ).all()
    return bot_detail(bot, product, list(reviews))


@router.post("/{slug}/reviews", status_code=201)
@limiter.limit("5/hour")
def review_bot(
    request: Request,
    slug: str,
    body: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bot = db.scalar(select(Bot).where(Bot.slug == slug, Bot.is_published.is_(True)))
    if not bot:
        raise HTTPException(404, "Bot not found")
    bought = db.scalar(
        select(Order.id)
        .join(Product, Product.id == Order.product_id)
        .where(Order.user_id == user.id, Order.status == "paid", Product.bot_id == bot.id)
        .limit(1)
    )
    if not bought:
        raise HTTPException(403, "Only buyers of this bot can leave a review")
    if db.scalar(select(Review.id).where(Review.bot_id == bot.id, Review.user_id == user.id)):
        raise HTTPException(409, "You already reviewed this bot")
    needs_approval = bool(site_settings.get_setting(db, "reviews_require_approval"))
    db.add(
        Review(
            bot_id=bot.id,
            user_id=user.id,
            author_name=user.name or user.email.split("@")[0],
            rating=body.rating,
            body=body.body,
            is_approved=not needs_approval,
        )
    )
    db.commit()
    return {"ok": True, "pending_approval": needs_approval}
