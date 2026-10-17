from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.core.deps import AdminContext, require_admin
from app.core.security import sha256_hex
from app.db import get_db
from app.models import Bot, BotCommand, BotSyncLog, DiscordToken, Product, Review
from app.schemas import BotCommandPatch, BotPatch, ReviewPatch
from app.serializers import bot_admin, columns, iso, review_out
from app.services import scheduler, site_settings
from app.services.audit import audit
from app.services.discord_sync import is_sync_running, run_sync

router = APIRouter(prefix="/admin/bots", tags=["admin-bots"])


def _get_bot(db: Session, bot_id: int) -> Bot:
    bot = db.scalar(select(Bot).where(Bot.id == bot_id).options(selectinload(Bot.commands)))
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot


@router.get("")
def list_bots(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    bots = db.scalars(select(Bot).options(selectinload(Bot.commands)).order_by(Bot.sort_order, Bot.username)).all()
    last = db.scalar(select(BotSyncLog).order_by(BotSyncLog.started_at.desc()).limit(1))
    return {
        "items": [bot_admin(b) for b in bots],
        "sync": {
            "running": is_sync_running(),
            "last": columns(last) if last else None,
            "next_run_at": iso(scheduler.next_run_at()),
            "interval_minutes": site_settings.get_setting(db, "discord_sync_interval_minutes"),
            "auto_publish": site_settings.get_setting(db, "auto_publish_new_bots"),
        },
    }


@router.get("/inbox")
def inbox(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    bots = db.scalars(
        select(Bot)
        .where(Bot.is_published.is_(False), Bot.is_hidden.is_(False))
        .options(selectinload(Bot.commands))
        .order_by(Bot.first_seen_at.desc())
    ).all()
    return {"items": [bot_admin(b) for b in bots]}


@router.get("/tokens")
def tokens(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    """Health of configured tokens. Raw token values are never returned."""
    configured = {sha256_hex(t) for t in settings.discord_tokens}
    rows = db.scalars(select(DiscordToken).order_by(DiscordToken.env_position.is_(None), DiscordToken.env_position)).all()
    known = {r.fingerprint for r in rows}
    return {
        "configured_count": len(configured),
        "unsynced_count": len(configured - known),
        "items": [
            {
                "id": r.id,
                "hint": r.masked_hint,
                "position": r.env_position,
                "status": r.status,
                "bot_discord_id": r.bot_discord_id,
                "bot_username": r.bot_username,
                "last_checked_at": iso(r.last_checked_at),
                "last_error": r.last_error,
                "configured": r.fingerprint in configured,
            }
            for r in rows
        ],
    }


@router.get("/sync-logs")
def sync_logs(
    db: Session = Depends(get_db),
    _: AdminContext = Depends(require_admin),
    limit: int = Query(25, ge=1, le=200),
):
    rows = db.scalars(select(BotSyncLog).order_by(BotSyncLog.started_at.desc()).limit(limit)).all()
    return {"items": [columns(r) for r in rows]}


@router.post("/sync", status_code=202)
def sync_now(
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: AdminContext = Depends(require_admin),
):
    if is_sync_running():
        return {"started": False, "message": "A sync is already running"}
    audit(db, admin.username, "bots.sync_requested", ip=admin.ip)
    db.commit()
    background.add_task(run_sync, "manual", admin.username)
    return {"started": True}


@router.get("/{bot_id}")
def get_bot(bot_id: int, db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    bot = _get_bot(db, bot_id)
    products = db.scalars(select(Product).where(Product.bot_id == bot.id)).all()
    reviews = db.scalars(select(Review).where(Review.bot_id == bot.id).order_by(Review.created_at.desc())).all()
    return {
        **bot_admin(bot),
        "products": [{"id": p.id, "name": p.name, "slug": p.slug} for p in products],
        "reviews": [{**review_out(r), "is_approved": r.is_approved} for r in reviews],
    }


@router.patch("/{bot_id}")
def update_bot(
    bot_id: int, body: BotPatch, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)
):
    bot = _get_bot(db, bot_id)
    changes = body.model_dump(exclude_unset=True)
    if "slug" in changes:
        if not changes["slug"]:
            raise HTTPException(400, "Slug cannot be empty")
        if db.scalar(select(Bot.id).where(Bot.slug == changes["slug"], Bot.id != bot.id)):
            raise HTTPException(409, "Slug already used")
    for k, v in changes.items():
        # Empty strings clear an override so the synced value shows through again.
        if isinstance(v, str) and v == "" and k != "slug":
            v = None
        setattr(bot, k, v)
    audit(db, admin.username, "bot.update", "bot", bot.id, {"fields": sorted(changes)}, ip=admin.ip)
    db.commit()
    return bot_admin(bot)


@router.post("/{bot_id}/publish")
def publish(bot_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    bot = _get_bot(db, bot_id)
    bot.is_published = True
    bot.is_hidden = False
    bot.published_at = bot.published_at or datetime.now(timezone.utc)
    audit(db, admin.username, "bot.publish", "bot", bot.id, {"username": bot.username}, ip=admin.ip)
    db.commit()
    return bot_admin(bot)


@router.post("/{bot_id}/unpublish")
def unpublish(bot_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    bot = _get_bot(db, bot_id)
    bot.is_published = False
    audit(db, admin.username, "bot.unpublish", "bot", bot.id, {"username": bot.username}, ip=admin.ip)
    db.commit()
    return bot_admin(bot)


@router.delete("/{bot_id}")
def delete_bot(bot_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    """Removes the bot record. If its token is still configured, the next sync re-imports it (unpublished)."""
    bot = _get_bot(db, bot_id)
    audit(db, admin.username, "bot.delete", "bot", bot.id, {"username": bot.username}, ip=admin.ip)
    db.delete(bot)
    db.commit()
    return {"ok": True}


@router.patch("/{bot_id}/commands/{command_id}")
def update_command(
    bot_id: int,
    command_id: int,
    body: BotCommandPatch,
    db: Session = Depends(get_db),
    admin: AdminContext = Depends(require_admin),
):
    cmd = db.scalar(select(BotCommand).where(BotCommand.id == command_id, BotCommand.bot_id == bot_id))
    if not cmd:
        raise HTTPException(404, "Command not found")
    cmd.is_hidden = body.is_hidden
    audit(db, admin.username, "bot.command_visibility", "bot_command", cmd.id,
          {"bot_id": bot_id, "hidden": body.is_hidden}, ip=admin.ip)
    db.commit()
    return {"ok": True}


@router.patch("/reviews/{review_id}")
def moderate_review(
    review_id: int, body: ReviewPatch, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    review.is_approved = body.is_approved
    audit(db, admin.username, "review.moderate", "review", review.id, {"approved": body.is_approved}, ip=admin.ip)
    db.commit()
    return {"ok": True}
