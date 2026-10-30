"""Vending X public API: stock listing, vending, and bot sync."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.ratelimit import limiter
from app.db import get_db, engine
from app.models.vendingx import VendingItem, VendingLog, VendingStock

_is_sqlite = str(engine.url).startswith("sqlite")

log = logging.getLogger(__name__)
router = APIRouter(prefix="/vendingx", tags=["vendingx"])

_cooldowns: dict[str, float] = {}


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
        }
        for t in types
    }


# ── Vend (dispense an item) ──


class VendRequest(BaseModel):
    stock_key: str
    user_id: str
    username: str = ""


@router.post("/vend")
@limiter.limit("10/minute")
def vend_item(request: Request, body: VendRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).timestamp()
    last = _cooldowns.get(body.user_id, 0)
    if now - last < settings.vendingx_cooldown_seconds:
        remaining = int(settings.vendingx_cooldown_seconds - (now - last))
        raise HTTPException(429, f"Cooldown: wait {remaining}s")

    stock_type = db.scalar(select(VendingStock).where(VendingStock.key == body.stock_key))
    if not stock_type:
        raise HTTPException(404, "Unknown stock type")

    stmt = (
        select(VendingItem)
        .where(VendingItem.stock_key == body.stock_key, VendingItem.dispensed.is_(False))
        .order_by(VendingItem.id)
        .limit(1)
    )
    if not _is_sqlite:
        stmt = stmt.with_for_update(skip_locked=True)
    item = db.scalar(stmt)
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

    remaining = db.scalar(
        select(func.count()).select_from(VendingItem)
        .where(VendingItem.stock_key == body.stock_key, VendingItem.dispensed.is_(False))
    )

    return {
        "ok": True,
        "content": item.content,
        "name": stock_type.name,
        "remaining": remaining or 0,
    }


# ── Bot sync: push stock from the Discord bot ──


class SyncPayload(BaseModel):
    stock: dict[str, list[str]]  # {key: [item1, item2, ...]}
    types: dict[str, dict]  # {key: {name, description, is_premium}}


def _check_bot_secret(request: Request):
    auth = request.headers.get("authorization", "")
    expected = settings.vendingx_bot_secret
    if not expected or auth != f"Bearer {expected}":
        raise HTTPException(403, "Invalid bot secret")


@router.post("/sync")
def sync_stock(request: Request, body: SyncPayload, db: Session = Depends(get_db)):
    _check_bot_secret(request)

    for key, info in body.types.items():
        existing = db.scalar(select(VendingStock).where(VendingStock.key == key))
        if existing:
            existing.name = info.get("name", key)
            existing.description = info.get("description", "")
            existing.is_premium = info.get("is_premium", key.startswith("premium_"))
        else:
            db.add(VendingStock(
                key=key,
                name=info.get("name", key),
                description=info.get("description", ""),
                is_premium=info.get("is_premium", key.startswith("premium_")),
            ))

    added = 0
    for key, items in body.stock.items():
        existing_contents = set(
            db.scalars(
                select(VendingItem.content).where(VendingItem.stock_key == key)
            ).all()
        )
        for content in items:
            if content.strip() and content not in existing_contents:
                db.add(VendingItem(stock_key=key, content=content.strip()))
                added += 1

    db.commit()
    return {"ok": True, "types": len(body.types), "items_added": added}


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

    stmt = (
        select(VendingItem)
        .where(VendingItem.stock_key == body.stock_key, VendingItem.dispensed.is_(False))
        .order_by(VendingItem.id)
        .limit(1)
    )
    if not _is_sqlite:
        stmt = stmt.with_for_update(skip_locked=True)
    item = db.scalar(stmt)
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

    remaining = db.scalar(
        select(func.count()).select_from(VendingItem)
        .where(VendingItem.stock_key == body.stock_key, VendingItem.dispensed.is_(False))
    )

    return {"ok": True, "content": item.content, "name": stock_type.name, "remaining": remaining or 0}
