from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone, timedelta

import aiohttp
from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse

from bot.db import get_db
from bot import access as access_mod

log = logging.getLogger("vendingx.web.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI", "https://xotiictech.net/vendingx/auth/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://xotiictech.net")
BOT_OWNER_ID = int(os.getenv("BOT_OWNER_ID", "1302203907782606880"))

DISCORD_API = "https://discord.com/api/v10"
SCOPES = "identify guilds.members.read"

_pending_states: dict[str, float] = {}


@router.get("/login")
async def login(request: Request) -> RedirectResponse:
    state = secrets.token_urlsafe(32)
    _pending_states[state] = datetime.now(timezone.utc).timestamp()
    url = (
        f"https://discord.com/oauth2/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={SCOPES.replace(' ', '%20')}"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/callback")
async def callback(request: Request, code: str = "", state: str = "") -> Response:
    if state not in _pending_states:
        return JSONResponse({"error": "Invalid state"}, status_code=400)

    issued_at = _pending_states.pop(state)
    if datetime.now(timezone.utc).timestamp() - issued_at > 600:
        return JSONResponse({"error": "State expired"}, status_code=400)

    async with aiohttp.ClientSession() as session:
        token_resp = await session.post(
            f"{DISCORD_API}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status != 200:
            return JSONResponse({"error": "Token exchange failed"}, status_code=400)
        tokens = await token_resp.json()

        user_resp = await session.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if user_resp.status != 200:
            return JSONResponse({"error": "Failed to fetch user"}, status_code=400)
        user = await user_resp.json()

    user_id = int(user["id"])
    username = user.get("username", "unknown")
    avatar = user.get("avatar", "")

    db = get_db()

    session_id = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)

    db.execute(
        "INSERT OR REPLACE INTO web_sessions "
        "(session_id, user_id, discord_username, discord_avatar, discord_access_token, discord_refresh_token, expires_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (session_id, user_id, username, avatar, tokens.get("access_token"), tokens.get("refresh_token"), expires.isoformat()),
    )
    db.commit()

    response = RedirectResponse(f"{FRONTEND_URL}/vendingx/")
    response.set_cookie(
        "vx_session",
        session_id,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,
    )
    return response


@router.get("/me")
async def me(request: Request) -> JSONResponse:
    session_id = request.cookies.get("vx_session")
    if not session_id:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    db = get_db()
    row = db.execute(
        "SELECT user_id, discord_username, discord_avatar, expires_at FROM web_sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()

    if not row:
        return JSONResponse({"error": "Session not found"}, status_code=401)

    user_id, username, avatar, expires_at = row
    if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        db.execute("DELETE FROM web_sessions WHERE session_id = ?", (session_id,))
        db.commit()
        return JSONResponse({"error": "Session expired"}, status_code=401)

    is_owner = user_id == BOT_OWNER_ID
    has_access = access_mod.check_payment(db, user_id) or is_owner

    return JSONResponse({
        "user_id": user_id,
        "username": username,
        "avatar": avatar,
        "is_owner": is_owner,
        "has_access": has_access,
    })


@router.post("/logout")
async def logout(request: Request) -> JSONResponse:
    session_id = request.cookies.get("vx_session")
    if session_id:
        db = get_db()
        db.execute("DELETE FROM web_sessions WHERE session_id = ?", (session_id,))
        db.commit()
    response = JSONResponse({"ok": True})
    response.delete_cookie("vx_session")
    return response
