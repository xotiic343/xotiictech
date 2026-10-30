"""API endpoints for the web portal.

  GET  /api/stock         – live inventory counts
  POST /api/vend          – dispense an item (web)
  POST /api/admin/upload  – upload stock (owner only)
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

from fastapi import APIRouter, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse

from bot import stock, parser, access as access_mod
from bot.db import get_db

log = logging.getLogger("vendingx.web.api")

router = APIRouter(prefix="/api", tags=["api"])

BOT_OWNER_ID = int(os.getenv("BOT_OWNER_ID", "1302203907782606880"))
COOLDOWN_SECONDS = 5

_ip_cooldowns: dict[str, float] = {}


def _get_session_user(request: Request) -> Optional[dict]:
    """Return session user dict or None."""
    session_id = request.cookies.get("vx_session")
    if not session_id:
        return None
    db = get_db()
    row = db.execute(
        "SELECT user_id, discord_username, discord_avatar FROM web_sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    if not row:
        return None
    return {"user_id": row[0], "username": row[1], "avatar": row[2]}


def _check_ip_cooldown(ip: str) -> tuple[bool, int]:
    """Per-IP rate limit (5s)."""
    last = _ip_cooldowns.get(ip, 0)
    elapsed = time.time() - last
    if elapsed < COOLDOWN_SECONDS:
        return True, int(COOLDOWN_SECONDS - elapsed)
    return False, 0


@router.get("/feed")
async def get_feed() -> JSONResponse:
    """Return the last 25 vend events for the live feed."""
    from bot.bot import STOCK_TYPES
    db = get_db()
    rows = db.execute(
        "SELECT u.username, s.stock_type, s.source, s.generated_at "
        "FROM stock_usage s JOIN users u ON u.id = s.user_id "
        "ORDER BY s.generated_at DESC LIMIT 25"
    ).fetchall()
    feed = []
    for username, stype, source, ts in rows:
        info = STOCK_TYPES.get(stype, {})
        feed.append({
            "username": username,
            "category": info.get("name", stype),
            "emoji": info.get("emoji", "📦"),
            "source": source,
            "time": ts,
        })
    return JSONResponse(feed)


@router.get("/stock")
async def get_stock() -> JSONResponse:
    """Return stock counts for all types."""
    from bot.bot import STOCK_TYPES
    result = {}
    for st, info in STOCK_TYPES.items():
        result[st] = {
            "name": info["name"],
            "emoji": info["emoji"],
            "description": info["description"],
            "count": stock.count(st),
            "premium": st.startswith("premium_"),
        }
    return JSONResponse(result)


@router.post("/vend")
async def vend(request: Request) -> JSONResponse:
    """Dispense an item via the web portal."""
    user = _get_session_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    body = await request.json()
    stock_type = body.get("stock_type", "").strip().lower()

    from bot.bot import STOCK_TYPES
    if stock_type not in STOCK_TYPES:
        return JSONResponse({"error": "Invalid stock type"}, status_code=400)

    user_id = user["user_id"]
    db = get_db()

    if not access_mod.check_payment(db, user_id) and user_id != BOT_OWNER_ID:
        return JSONResponse({"error": "Access required"}, status_code=403)

    from bot.access import cooldowns
    on_cd, secs = cooldowns.check(user_id, "web")
    if on_cd:
        return JSONResponse({"error": f"Cooldown: {secs}s remaining"}, status_code=429)

    client_ip = request.client.host if request.client else "unknown"
    ip_cd, ip_secs = _check_ip_cooldown(client_ip)
    if ip_cd:
        return JSONResponse({"error": f"Rate limited: {ip_secs}s"}, status_code=429)

    entry = stock.dispense(stock_type)
    if not entry:
        return JSONResponse({"error": "Out of stock"}, status_code=404)

    cooldowns.set(user_id, "web")
    _ip_cooldowns[client_ip] = time.time()

    info = STOCK_TYPES[stock_type]

    db.execute("INSERT OR IGNORE INTO users (id, username, total_generated) VALUES (?, ?, 0)", (user_id, user["username"]))
    db.execute(
        "INSERT INTO stock_usage (user_id, stock_type, stock_content, source) VALUES (?, ?, ?, 'WEB')",
        (user_id, stock_type, entry),
    )
    db.execute("UPDATE users SET total_generated = total_generated + 1 WHERE id = ?", (user_id,))
    db.commit()

    remaining = stock.count(stock_type)

    # Queue owner DM log via the bot (if running)
    try:
        from bot.logging import log_vend
        from main import bot as discord_bot
        import asyncio
        await log_vend(discord_bot, user["username"], info["name"], stock_type, "WEB", entry, remaining)
    except Exception:
        log.debug("Bot not available for DM logging from web vend")

    return JSONResponse({
        "item": entry,
        "stock_type": stock_type,
        "name": info["name"],
        "remaining": remaining,
    })


@router.post("/admin/upload")
async def admin_upload(
    request: Request,
    stock_type: str = Form(...),
    file: UploadFile = File(...),
) -> JSONResponse:
    """Upload stock entries (owner only)."""
    user = _get_session_user(request)
    if not user or user["user_id"] != BOT_OWNER_ID:
        return JSONResponse({"error": "Owner only"}, status_code=403)

    if not file.filename or not file.filename.endswith(".txt"):
        return JSONResponse({"error": "Only .txt files allowed"}, status_code=400)

    content = (await file.read()).decode("utf-8", errors="ignore")
    entries = parser.auto_parse(stock_type, content)
    if not entries:
        return JSONResponse({"error": "No entries parsed"}, status_code=400)

    total = stock.add_entries(stock_type, entries)

    return JSONResponse({
        "added": len(entries),
        "total": total,
        "stock_type": stock_type,
    })
