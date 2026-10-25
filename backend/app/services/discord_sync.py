"""Auto-import & sync of every bot whose token is listed in DISCORD_BOT_TOKENS.

For each token:  /users/@me → /applications/@me → guild count → global (and optional guild) commands,
then upsert into `bots` / `bot_commands` by Discord user ID. Admin override columns are never touched.
"""

import logging
import threading
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import sha256_hex
from app.db import SessionLocal, engine
from app.models import Bot, BotCommand, BotSyncLog, DiscordToken
from app.services import site_settings
from app.services.audit import audit
from app.services.bot_files import apply_bot_file, load_bot_files
from app.services.discord_client import DiscordAuthError, DiscordClient, DiscordError
from app.services.slugs import unique_slug

log = logging.getLogger(__name__)

_ADVISORY_LOCK_ID = 7_331_001  # arbitrary, app-wide constant
_local_lock = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def mask_token(token: str, position: int) -> str:
    return f"token #{position} (…{token[-4:]})" if len(token) > 8 else f"token #{position}"


class _SyncLock:
    """Process lock + Postgres advisory lock so multiple workers/instances never sync concurrently."""

    def __init__(self) -> None:
        self._conn = None
        self._held_local = False

    def acquire(self) -> bool:
        if not _local_lock.acquire(blocking=False):
            return False
        self._held_local = True
        if engine.dialect.name == "postgresql":
            self._conn = engine.connect()
            got = self._conn.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": _ADVISORY_LOCK_ID}).scalar()
            if not got:
                self.release()
                return False
        return True

    def release(self) -> None:
        if self._conn is not None:
            try:
                self._conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _ADVISORY_LOCK_ID})
            finally:
                self._conn.close()
                self._conn = None
        if self._held_local:
            _local_lock.release()
            self._held_local = False


def is_sync_running() -> bool:
    return _local_lock.locked()


def run_sync(trigger: str = "scheduled", actor: str = "system") -> int | None:
    """Entry point for the scheduler / admin button. Returns the sync log id (None if skipped)."""
    lock = _SyncLock()
    if not lock.acquire():
        log.info("Bot sync already running; skipping (%s)", trigger)
        return None
    try:
        with SessionLocal() as db:
            return _sync(db, trigger, actor)
    except Exception:
        log.exception("Bot sync crashed")
        return None
    finally:
        lock.release()


def _sync(db: Session, trigger: str, actor: str) -> int:
    run = BotSyncLog(trigger=trigger, status="running", started_at=_now(), errors=[])
    db.add(run)
    db.commit()

    tokens = settings.discord_tokens
    auto_publish = bool(site_settings.get_setting(db, "auto_publish_new_bots"))
    errors: list[dict] = []
    seen_bot_ids: set[str] = set()
    seen_fingerprints: set[str] = set()
    new_count = failed = 0

    for position, token in enumerate(tokens, start=1):
        fp = sha256_hex(token)
        seen_fingerprints.add(fp)
        tok = db.scalar(select(DiscordToken).where(DiscordToken.fingerprint == fp))
        if tok is None:
            tok = DiscordToken(fingerprint=fp, masked_hint=mask_token(token, position))
            db.add(tok)
        tok.env_position = position
        tok.masked_hint = mask_token(token, position)
        tok.last_checked_at = _now()

        try:
            with DiscordClient(token) as client:
                bot, is_new = _sync_one(db, client, auto_publish)
            seen_bot_ids.add(bot.discord_id)
            tok.status, tok.last_error = "healthy", None
            tok.bot_discord_id, tok.bot_username = bot.discord_id, bot.username
            new_count += int(is_new)
            if is_new:
                audit(db, "system", "bot.discovered", "bot", bot.id, {"username": bot.username, "trigger": trigger})
        except DiscordAuthError as exc:
            failed += 1
            tok.status, tok.last_error = "invalid", str(exc)
            errors.append({"token": tok.masked_hint, "error": str(exc)})
            _mark_bot_offline(db, tok.bot_discord_id, "Token invalid — rotate it in Render")
        except DiscordError as exc:
            failed += 1
            tok.status, tok.last_error = "error", str(exc)
            errors.append({"token": tok.masked_hint, "error": str(exc)})
            _mark_bot_offline(db, tok.bot_discord_id, str(exc))
        except Exception as exc:  # never let one bot kill the whole run
            failed += 1
            msg = f"{type(exc).__name__} during sync"
            log.exception("Unexpected error syncing %s", tok.masked_hint)
            tok.status, tok.last_error = "error", msg
            errors.append({"token": tok.masked_hint, "error": msg})
        db.commit()

    # Tokens removed from env, and bots that no longer have a token.
    for tok in db.scalars(select(DiscordToken)):
        if tok.fingerprint not in seen_fingerprints and tok.status != "removed":
            tok.status, tok.env_position = "removed", None
    healthy_ids = {
        t.bot_discord_id for t in db.scalars(select(DiscordToken).where(DiscordToken.status == "healthy"))
    }
    for bot in db.scalars(select(Bot).where(Bot.status == "online")):
        if bot.discord_id not in healthy_ids:
            bot.status = "offline"
            bot.last_error = bot.last_error or "No healthy token configured for this bot"

    run.bots_seen = len(seen_bot_ids)
    run.bots_new = new_count
    run.bots_failed = failed
    run.errors = errors
    run.finished_at = _now()
    if not tokens:
        run.status = "skipped"
        run.errors = [{"token": "-", "error": "DISCORD_BOT_TOKENS is empty"}]
    elif failed == 0:
        run.status = "success"
    elif failed < len(tokens):
        run.status = "partial"
    else:
        run.status = "failed"
    audit(
        db,
        actor,
        "bots.sync",
        "bot_sync_log",
        run.id,
        {"trigger": trigger, "status": run.status, "seen": run.bots_seen, "new": new_count, "failed": failed},
    )
    db.commit()
    log.info("Bot sync %s: %s seen, %s new, %s failed", run.status, run.bots_seen, new_count, failed)
    return run.id


def _sync_one(db: Session, client: DiscordClient, auto_publish: bool) -> tuple[Bot, bool]:
    me = client.me()
    if not me.get("bot"):
        raise DiscordError("token does not belong to a bot account")
    app = client.application()
    app_id = str(app.get("id") or me["id"])

    guild_count = app.get("approximate_guild_count")
    guilds: list[dict] | None = None
    if guild_count is None or settings.discord_sync_guild_commands:
        guilds = client.guilds()
        guild_count = len(guilds)

    commands = [(None, c) for c in client.global_commands(app_id)]
    if settings.discord_sync_guild_commands and guilds and len(guilds) <= 25:
        for g in guilds:
            try:
                commands += [(g["id"], c) for c in client.guild_commands(app_id, g["id"])]
            except DiscordError as exc:
                if exc.status != 403:
                    raise

    bot = db.scalar(select(Bot).where(Bot.discord_id == str(me["id"])))
    is_new = bot is None
    if is_new:
        bot = Bot(
            discord_id=str(me["id"]),
            username=me.get("username") or "bot",
            slug=unique_slug(db, Bot, me.get("username") or f"bot-{me['id']}"),
            is_published=auto_publish,
            published_at=_now() if auto_publish else None,
            first_seen_at=_now(),
            media=[],
            app_tags=[],
            install_scopes=[],
        )
        db.add(bot)

    install = app.get("install_params") or {}
    bot.application_id = app_id
    bot.username = me.get("username") or bot.username
    bot.avatar_hash = me.get("avatar")
    bot.banner_hash = me.get("banner")
    bot.app_description = app.get("description") or None
    bot.app_tags = list(app.get("tags") or [])
    bot.bot_public = bool(app.get("bot_public", True))
    bot.guild_count = int(guild_count or 0)
    bot.install_scopes = list(install.get("scopes") or [])
    bot.install_permissions = install.get("permissions")
    bot.custom_install_url = app.get("custom_install_url")
    bot.status = "online"
    bot.last_error = None
    bot.last_synced_at = _now()
    db.flush()

    _upsert_commands(db, bot, commands)
    # Hand-written details from backend/my-bots/ win over the thin data Discord provides.
    if apply_bot_file(bot, load_bot_files()):
        log.info("applied my-bots details to %s", bot.slug)
    return bot, is_new


def _upsert_commands(db: Session, bot: Bot, commands: list[tuple[str | None, dict]]) -> None:
    existing = {c.discord_command_id: c for c in bot.commands}
    seen: set[str] = set()
    now = _now()
    for guild_id, c in commands:
        cid = str(c["id"])
        seen.add(cid)
        row = existing.get(cid)
        if row is None:
            row = BotCommand(bot_id=bot.id, discord_command_id=cid)
            bot.commands.append(row)
        row.guild_id = guild_id
        row.name = c.get("name", "")[:100]
        row.description = (c.get("description") or "")[:300] or None
        row.type = int(c.get("type", 1))
        row.options = c.get("options") or []
        row.synced_at = now
    for cid, row in existing.items():
        if cid not in seen:
            bot.commands.remove(row)


def _mark_bot_offline(db: Session, discord_id: str | None, reason: str) -> None:
    if not discord_id:
        return
    bot = db.scalar(select(Bot).where(Bot.discord_id == discord_id))
    if bot:
        bot.status = "offline"
        bot.last_error = reason
