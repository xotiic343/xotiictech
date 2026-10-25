"""Model → JSON shapes. Public shapes never include private fields (deliverable keys, tokens, errors)."""

from datetime import datetime
from typing import Any

from app.models import (
    BlogPost,
    Bot,
    BotCommand,
    DocPage,
    Order,
    Product,
    Review,
    Testimonial,
)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def columns(obj: Any, exclude: set[str] = frozenset()) -> dict[str, Any]:
    out = {}
    for col in obj.__table__.columns:
        if col.key in exclude:
            continue
        val = getattr(obj, col.key)
        out[col.key] = iso(val) if isinstance(val, datetime) else val
    return out


# ---------------- bots ----------------


def command_out(c: BotCommand) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "type": c.type,
        "options": c.options or [],
        "guild_scoped": c.guild_id is not None,
    }


def bot_card(b: Bot) -> dict:
    return {
        "id": b.id,
        "slug": b.slug,
        "name": b.name,
        "description": b.description,
        "avatar_url": b.avatar_url,
        "banner_url": b.banner_url,
        "tags": b.effective_tags,
        "category": b.category,
        "guild_count": b.guild_count,
        "command_count": sum(1 for c in b.commands if not c.is_hidden),
        "status": b.status,
        "is_featured": b.is_featured,
        "pricing_type": b.pricing_type,
        "price_label": b.price_label,
        "published_at": iso(b.published_at),
        "first_seen_at": iso(b.first_seen_at),
    }


def bot_detail(b: Bot, product: Product | None, reviews: list[Review]) -> dict:
    return {
        **bot_card(b),
        "long_description": b.long_description or b.app_description or "",
        "media": b.media or [],
        "support_url": b.support_url,
        "website_url": b.website_url,
        "invite_url": b.invite_url if b.bot_public else None,
        "version": b.version,
        "changelog": b.changelog,
        "last_synced_at": iso(b.last_synced_at),
        "live_stats": b.live_stats or [],
        "live_stats_at": iso(b.live_stats_at),
        "commands": [command_out(c) for c in b.commands if not c.is_hidden],
        "product": product_card(product) if product and product.is_published else None,
        "reviews": [review_out(r) for r in reviews],
        "rating": round(sum(r.rating for r in reviews) / len(reviews), 2) if reviews else None,
    }


def bot_admin(b: Bot) -> dict:
    return {
        **columns(b),
        "name": b.name,
        "avatar_url": b.avatar_url,
        "banner_url": b.banner_url,
        "invite_url": b.invite_url,
        "effective_tags": b.effective_tags,
        "commands": [{**command_out(c), "is_hidden": c.is_hidden} for c in b.commands],
    }


def review_out(r: Review) -> dict:
    return {"id": r.id, "author": r.author_name, "rating": r.rating, "body": r.body, "created_at": iso(r.created_at)}


# ---------------- store ----------------


def product_card(p: Product) -> dict:
    return {
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "tagline": p.tagline,
        "category": p.category,
        "sell_type": p.sell_type,
        "price_cents": p.price_cents,
        "currency": p.currency,
        "media": (p.media or [])[:1],
        "version": p.version,
        "is_featured": p.is_featured,
        "is_bot": p.is_bot,
        "bot_slug": p.bot.slug if p.bot and p.bot.is_published and not p.bot.is_hidden else None,
        "updated_at": iso(p.updated_at),
    }


def product_detail(p: Product) -> dict:
    return {
        **product_card(p),
        "description": p.description,
        "features": p.features or [],
        "media": p.media or [],
        "changelog": p.changelog,
        "has_download": p.has_download,
        "sales_count": p.sales_count,
        "created_at": iso(p.created_at),
    }


def product_admin(p: Product) -> dict:
    return columns(p)


# ---------------- orders ----------------


def order_admin(o: Order) -> dict:
    return {**columns(o), "product_slug": o.product.slug if o.product else None}


def order_buyer(o: Order) -> dict:
    return {
        "id": o.public_id,
        "product_name": o.product_name,
        "product_slug": o.product.slug if o.product else None,
        "amount_cents": o.amount_cents,
        "currency": o.currency,
        "status": o.status,
        "paid_at": iso(o.paid_at),
        "download_expires_at": iso(o.download_expires_at),
        "has_download": bool(o.product and o.product.has_download),
        "is_hosted": bool(o.product and o.product.sell_type == "hosted"),
        "hosting_status": o.hosting_status,
        "hosting_server_id": o.hosting_server_id,
    }


# ---------------- content ----------------


def blog_out(p: BlogPost, full: bool = False) -> dict:
    return columns(p, exclude=set() if full else {"body"})


def doc_out(d: DocPage, full: bool = False) -> dict:
    return columns(d, exclude=set() if full else {"body"})


def testimonial_out(t: Testimonial) -> dict:
    return columns(t)
