"""Vending X public API: stock listing, vending, and bot sync."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import constant_time_equals
from app.db import engine, get_db
from app.models.vendingx import VendingItem, VendingLog, VendingStock

_is_sqlite = str(engine.url).startswith("sqlite")

log = logging.getLogger(__name__)
router = APIRouter(prefix="/vendingx", tags=["vendingx"])

_cooldowns: dict[str, float] = {}


def _check_bot_secret(request: Request) -> None:
    """Server-to-server auth for the Discord bot and the website's vend route. Browsers never hold this
    secret, so a call that reaches the API through the public /api proxy cannot pass it."""
    expected = settings.vendingx_bot_secret
    auth = request.headers.get("authorization", "")
    if not expected or not constant_time_equals(auth, f"Bearer {expected}"):
        raise HTTPException(403, "Invalid bot secret")


def _remaining(db: Session, key: str) -> int:
    return db.scalar(
        select(func.count()).select_from(VendingItem)
        .where(VendingItem.stock_key == key, VendingItem.dispensed.is_(False))
    ) or 0


def _take_item(db: Session, key: str) -> VendingItem | None:
    stmt = (
        select(VendingItem)
        .where(VendingItem.stock_key == key, VendingItem.dispensed.is_(False))
        .order_by(VendingItem.id)
        .limit(1)
    )
    if not _is_sqlite:
        stmt = stmt.with_for_update(skip_locked=True)
    return db.scalar(stmt)


# ── Stock listing ──


@router.get("/stock")
def list_stock(db: Session = Depends(get_db)):
    types = db.scalars(select(VendingStock).order_by(VendingStock.sort_order, VendingStock.key)).all()
    counts = dict(
        db.execute(
            select(VendingItem.stock_key, func.count())
            .where(VendingItem.dispensed.is_(False))
            .group_by(VendingItem.stock_key)
        ).all()
    )
    return {
        t.key: {
            "name": t.name,
            "description": t.description,
            "count": counts.get(t.key, 0),
            "premium": t.is_premium,
            "icon": t.icon_url,
        }
        for t in types
    }


# ── Vend (called by the website's server route, never by browsers) ──


class VendRequest(BaseModel):
    stock_key: str
    user_id: str
    username: str = ""
    premium: bool = False


@router.post("/vend")
def vend_item(request: Request, body: VendRequest, db: Session = Depends(get_db)):
    _check_bot_secret(request)

    stock_type = db.scalar(select(VendingStock).where(VendingStock.key == body.stock_key))
    if not stock_type:
        raise HTTPException(404, "Unknown item")
    if stock_type.is_premium and not body.premium:
        raise HTTPException(403, "Premium access required")

    now = datetime.now(timezone.utc).timestamp()
    last = _cooldowns.get(body.user_id, 0)
    if now - last < settings.vendingx_cooldown_seconds:
        remaining = int(settings.vendingx_cooldown_seconds - (now - last)) + 1
        raise HTTPException(429, f"Cooldown: wait {remaining}s")

    item = _take_item(db, body.stock_key)
    if not item:
        raise HTTPException(410, "Out of stock")

    item.dispensed = True
    item.dispensed_to = body.user_id
    item.dispensed_at = datetime.now(timezone.utc)
    db.add(VendingLog(
        user_id=body.user_id,
        username=body.username,
        stock_key=body.stock_key,
        stock_name=stock_type.name,
        source="WEB",
    ))
    db.commit()
    _cooldowns[body.user_id] = now

    return {"ok": True, "content": item.content, "name": stock_type.name, "remaining": _remaining(db, body.stock_key)}


# ── Bot sync: push stock from the Discord bot ──


class SyncPayload(BaseModel):
    stock: dict[str, list[str]]  # {key: [item1, item2, ...]}
    types: dict[str, dict]  # {key: {name, description, is_premium}}


@router.post("/sync")
def sync_stock(request: Request, body: SyncPayload, db: Session = Depends(get_db)):
    _check_bot_secret(request)

    # Name, tier and icon are only set when a type is first seen, so edits made in the admin panel stick.
    for key, info in body.types.items():
        if db.scalar(select(VendingStock.id).where(VendingStock.key == key)) is None:
            db.add(VendingStock(
                key=key,
                name=info.get("name", key),
                description=info.get("description", ""),
                is_premium=info.get("is_premium", key.startswith("premium_")),
            ))

    added = removed = 0
    web_dispensed: dict[str, list[str]] = {}
    for key, items in body.stock.items():
        ordered = list(dict.fromkeys(c.strip() for c in items if c.strip()))
        bot_items = set(ordered)
        rows = db.execute(
            select(VendingItem.id, VendingItem.content, VendingItem.dispensed, VendingItem.origin)
            .where(VendingItem.stock_key == key)
        ).all()
        known = {r.content for r in rows}

        # Items the bot no longer has were vended in Discord (or deleted): drop them so the site can't hand
        # them out again.
        gone = [r.id for r in rows if r.origin == "bot" and not r.dispensed and r.content not in bot_items]
        if gone:
            db.execute(delete(VendingItem).where(VendingItem.id.in_(gone)))
            removed += len(gone)

        for content in ordered:
            if content not in known:
                db.add(VendingItem(stock_key=key, content=content, origin="bot"))
                added += 1

        # Items the site already gave out that the bot still lists, so the bot can remove them from its files.
        taken = sorted({r.content for r in rows if r.dispensed} & bot_items)
        if taken:
            web_dispensed[key] = taken

    db.commit()
    return {
        "ok": True,
        "types": len(body.types),
        "items_added": added,
        "items_removed": removed,
        "web_dispensed": web_dispensed,
    }


# ── Bot vend: the bot can dispense through the API too ──


class BotVendRequest(BaseModel):
    stock_key: str
    user_id: str
    username: str = ""


@router.post("/bot-vend")
def bot_vend(request: Request, body: BotVendRequest, db: Session = Depends(get_db)):
    _check_bot_secret(request)

    stock_type = db.scalar(select(VendingStock).where(VendingStock.key == body.stock_key))
    if not stock_type:
        raise HTTPException(404, "Unknown stock type")

    item = _take_item(db, body.stock_key)
    if not item:
        raise HTTPException(410, "Out of stock")

    item.dispensed = True
    item.dispensed_to = body.user_id
    item.dispensed_at = datetime.now(timezone.utc)
    db.add(VendingLog(
        user_id=body.user_id,
        username=body.username,
        stock_key=body.stock_key,
        stock_name=stock_type.name,
        source="BOT",
    ))
    db.commit()

    return {"ok": True, "content": item.content, "name": stock_type.name, "remaining": _remaining(db, body.stock_key)}
