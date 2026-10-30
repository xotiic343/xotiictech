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
    last = _ip_cooldowns.get(ip, 0)
    elapsed = time.time() - last
    if elapsed < COOLDOWN_SECONDS:
        return True, int(COOLDOWN_SECONDS - elapsed)
    return False, 0


@router.get("/feed")
async def get_feed() -> JSONResponse:
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
            "source": source,
            "time": ts,
        })
    return JSONResponse(feed)


@router.get("/stock")
async def get_stock() -> JSONResponse:
    from bot.bot import STOCK_TYPES, refresh_stock_types
    refresh_stock_types()
    result = {}
    for st, info in STOCK_TYPES.items():
        result[st] = {
            "name": info["name"],
            "description": info["description"],
            "count": stock.count(st),
            "premium": st.startswith("premium_"),
        }
    return JSONResponse(result)


@router.post("/vend")
async def vend(request: Request) -> JSONResponse:
    user = _get_session_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    body = await request.json()
    stock_type = body.get("stock_type", "").strip().lower()

    from bot.bot import STOCK_TYPES, refresh_stock_types
    refresh_stock_types()
    if stock_type not in STOCK_TYPES:
        return JSONResponse({"error": "Invalid stock type"}, status_code=400)

    user_id = user["user_id"]
    db = get_db()
    is_premium = stock_type.startswith("premium_")

    if is_premium and not access_mod.check_payment(db, user_id) and user_id != BOT_OWNER_ID:
        return JSONResponse({"error": "Premium access required"}, status_code=403)

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

    try:
        from bot.logging import log_vend
        from main import bot as discord_bot
        await log_vend(discord_bot, user["username"], info["name"], stock_type, "WEB", entry, remaining)
    except Exception:
        log.debug("Bot not available for DM logging from web vend")

    return JSONResponse({
        "item": entry,
        "stock_type": stock_type,
        "name": info["name"],
        "remaining": remaining,
    })


def _check_admin(request: Request) -> bool:
    key = request.headers.get("x-api-key")
    configured_key = os.getenv("API_KEY", "")
    if key and configured_key and key == configured_key:
        return True
    user = _get_session_user(request)
    return bool(user and user["user_id"] == BOT_OWNER_ID)


@router.get("/admin/stats")
async def admin_stats(request: Request) -> JSONResponse:
    if not _check_admin(request):
        return JSONResponse({"error": "Owner only"}, status_code=403)

    from bot.bot import STOCK_TYPES, refresh_stock_types
    refresh_stock_types()

    db = get_db()
    total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_vends = db.execute("SELECT COUNT(*) FROM stock_usage").fetchone()[0]
    total_payments = db.execute(
        "SELECT COUNT(*) FROM stripe_payments WHERE status = 'paid'"
    ).fetchone()[0]
    vends_today = db.execute(
        "SELECT COUNT(*) FROM stock_usage WHERE date(generated_at) = date('now')"
    ).fetchone()[0]
    total_stock = sum(stock.count(st) for st in STOCK_TYPES)
    top = db.execute(
        "SELECT stock_type, COUNT(*) as cnt FROM stock_usage "
        "GROUP BY stock_type ORDER BY cnt DESC LIMIT 10"
    ).fetchall()

    return JSONResponse({
        "total_users": total_users,
        "total_vends": total_vends,
        "total_payments": total_payments,
        "vends_today": vends_today,
        "total_stock": total_stock,
        "top_types": [
            {"type": t, "name": STOCK_TYPES.get(t, {}).get("name", t), "count": c}
            for t, c in top
        ],
    })


@router.get("/admin/users")
async def admin_users(request: Request) -> JSONResponse:
    if not _check_admin(request):
        return JSONResponse({"error": "Owner only"}, status_code=403)

    db = get_db()
    rows = db.execute(
        "SELECT id, username, total_generated, last_generated "
        "FROM users ORDER BY total_generated DESC LIMIT 50"
    ).fetchall()
    return JSONResponse([
        {"id": r[0], "username": r[1], "total_generated": r[2], "last_generated": r[3]}
        for r in rows
    ])


@router.get("/admin/config")
async def get_config(request: Request) -> JSONResponse:
    if not _check_admin(request):
        return JSONResponse({"error": "Owner only"}, status_code=403)

    db = get_db()
    rows = db.execute(
        "SELECT server_id, log_channel_id, announce_channel_id, announce_role_id, "
        "auto_update_channel_id, auto_update_role_id, beta_update_channel_id, beta_update_role_id "
        "FROM vending_configs"
    ).fetchall()
    return JSONResponse([
        {
            "server_id": r[0], "log_channel_id": r[1],
            "announce_channel_id": r[2], "announce_role_id": r[3],
            "auto_update_channel_id": r[4], "auto_update_role_id": r[5],
            "beta_update_channel_id": r[6], "beta_update_role_id": r[7],
        }
        for r in rows
    ])


@router.post("/admin/config")
async def set_config(request: Request) -> JSONResponse:
    if not _check_admin(request):
        return JSONResponse({"error": "Owner only"}, status_code=403)

    body = await request.json()
    server_id = body.get("server_id")
    if not server_id:
        return JSONResponse({"error": "server_id required"}, status_code=400)

    cols = ("log_channel_id", "announce_channel_id", "announce_role_id",
            "auto_update_channel_id", "auto_update_role_id",
            "beta_update_channel_id", "beta_update_role_id")
    vals = [body.get(c) for c in cols]

    db = get_db()
    db.execute(
        "INSERT INTO vending_configs (server_id, " + ", ".join(cols) + ") "
        "VALUES (?, " + ", ".join("?" for _ in cols) + ") "
        "ON CONFLICT(server_id) DO UPDATE SET "
        + ", ".join(f"{c} = excluded.{c}" for c in cols),
        (server_id, *vals),
    )
    db.commit()
    return JSONResponse({"ok": True})


@router.get("/admin/banned")
async def admin_banned(request: Request) -> JSONResponse:
    if not _check_admin(request):
        return JSONResponse({"error": "Owner only"}, status_code=403)

    db = get_db()
    rows = db.execute(
        "SELECT user_id, reason, banned_at FROM banned_users ORDER BY banned_at DESC"
    ).fetchall()
    return JSONResponse([
        {"user_id": r[0], "reason": r[1], "banned_at": r[2]} for r in rows
    ])


@router.post("/admin/upload")
async def admin_upload(
    request: Request,
    stock_type: str = Form(...),
    file: UploadFile = File(...),
) -> JSONResponse:
    if not _check_admin(request):
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
