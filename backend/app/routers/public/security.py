"""Security X public + bot routes.

Public (members):
  GET  /api/security/verify/info?g=<guild>   server name/icon for the consent page
  GET  /api/security/oauth/start?g=<guild>   -> Discord login (identify + guilds.join)
  GET  /api/security/oauth/callback          stores consent, asks the bot for the verified role
Bot ("Authorization: Bearer SECURITY_BOT_SECRET"):
  POST /api/security/bot/state | /logs | /jobs | /jobs/{id} | /pulls | /pulls/status
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import constant_time_equals, create_token, decode_token
from app.db import get_db
from app.models import PullJob, SecurityGuild, SecurityJob, SecurityLog
from app.services import security as sx

router = APIRouter(prefix="/security", tags=["security-x"])

SNOWFLAKE = r"^\d{5,25}$"
STATE_TOKEN = "sxoauth"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def require_bot(request: Request) -> None:
    secret = settings.security_bot_secret
    header = request.headers.get("authorization", "")
    if not secret:
        raise HTTPException(503, "SECURITY_BOT_SECRET is not set on the API")
    if not header.startswith("Bearer ") or not constant_time_equals(header[7:].strip(), secret):
        raise HTTPException(401, "Bad bot secret")


# ---------------- consent verify page ----------------


def _done(guild_id: str, status: str, message: str = "") -> RedirectResponse:
    q = urlencode({"g": guild_id, "s": status, **({"m": message[:200]} if message else {})})
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/security/verify/done?{q}", status_code=303)


@router.get("/verify/info")
def verify_info(g: str, db: Session = Depends(get_db)):
    guild = db.get(SecurityGuild, g) if g.isdigit() else None
    if not guild:
        raise HTTPException(404, "Security X is not in that server")
    verify = ((guild.state or {}).get("config") or {}).get("verify") or {}
    return {
        "guild": {"id": guild.guild_id, "name": guild.name, "icon": guild.icon_url, "members": guild.member_count},
        "ready": bool(verify.get("roleId")) and sx.oauth_configured(),
    }


@router.get("/oauth/start")
def oauth_start(g: str, db: Session = Depends(get_db)):
    if not g.isdigit() or not db.get(SecurityGuild, g):
        raise HTTPException(404, "Security X is not in that server")
    if not sx.oauth_configured():
        raise HTTPException(503, "Verification is not configured yet")
    state = create_token(g, STATE_TOKEN, timedelta(minutes=10), {"n": secrets.token_hex(8)})
    params = {
        "client_id": settings.security_client_id,
        "response_type": "code",
        "scope": "identify guilds.join",
        "redirect_uri": sx.redirect_uri(),
        "state": state,
        "prompt": "consent",
    }
    return RedirectResponse(f"https://discord.com/oauth2/authorize?{urlencode(params, quote_via=quote)}", status_code=303)


@router.get("/oauth/callback")
def oauth_callback(state: str = "", code: str = "", error: str = "", db: Session = Depends(get_db)):
    claims = decode_token(state, STATE_TOKEN) if state else None
    if not claims:
        raise HTTPException(400, "This verification link expired. Start again from the Verify button.")
    guild_id = claims["sub"]
    if error or not code:
        return _done(guild_id, "cancelled")
    try:
        tokens = sx.exchange_code(code)
        if "guilds.join" not in (tokens.get("scope") or ""):
            return _done(guild_id, "error", "Permission to add you to the backup server was not granted.")
        user = sx.fetch_user(tokens["access_token"])
    except Exception:
        return _done(guild_id, "error", "Discord login failed. Please try again.")

    sx.save_member(db, guild_id, user, tokens)
    db.commit()
    job = sx.enqueue(db, guild_id, "verify.grant", {"userId": str(user["id"])})
    result = sx.wait_for(job.id, timeout=12)
    if result and result.status == "done":
        return _done(guild_id, "ok")
    if result and result.status == "failed":
        return _done(guild_id, "error", result.error or "The bot could not give you the verified role.")
    return _done(guild_id, "pending")  # consent saved; the bot gives the role once it's back online


# ---------------- bot API ----------------


class StateIn(BaseModel):
    botId: str | None = None
    guilds: list[dict[str, Any]] = Field(default_factory=list, max_length=500)


@router.post("/bot/state", dependencies=[Depends(require_bot)])
def bot_state(body: StateIn, db: Session = Depends(get_db)):
    for g in body.guilds:
        gid = str(g.get("id") or "")
        if not gid.isdigit():
            continue
        row = db.get(SecurityGuild, gid) or SecurityGuild(guild_id=gid)
        row.name = str(g.get("name") or gid)[:120]
        row.icon_url = (g.get("icon") or None) and str(g["icon"])[:500]
        row.member_count = int(g.get("memberCount") or 0)
        row.state = g.get("state") or {}
        row.updated_at = _now()
        db.add(row)
    db.commit()
    return {"ok": True}


class LogEventIn(BaseModel):
    guildId: str = Field(pattern=SNOWFLAKE)
    type: str = Field(max_length=20)
    summary: str = Field(default="", max_length=300)
    data: dict[str, Any] | None = None
    at: datetime | None = None


class LogsIn(BaseModel):
    events: list[LogEventIn] = Field(max_length=200)


@router.post("/bot/logs", dependencies=[Depends(require_bot)])
def bot_logs(body: LogsIn, db: Session = Depends(get_db)):
    for e in body.events:
        db.add(SecurityLog(guild_id=e.guildId, type=e.type, summary=e.summary, data=e.data, created_at=e.at or _now()))
    if secrets.randbelow(50) == 0:  # now and then, drop logs older than 30 days
        db.execute(delete(SecurityLog).where(SecurityLog.created_at < _now() - timedelta(days=30)))
    db.commit()
    return {"ok": True, "stored": len(body.events)}


@router.post("/bot/jobs", dependencies=[Depends(require_bot)])
def bot_jobs(db: Session = Depends(get_db)):
    return {"jobs": [{"id": j.id, "kind": j.kind, "payload": j.payload} for j in sx.claim_jobs(db)]}


class JobResultIn(BaseModel):
    ok: bool
    result: dict[str, Any] | None = None
    error: str | None = Field(default=None, max_length=500)


@router.post("/bot/jobs/{job_id}", dependencies=[Depends(require_bot)])
def bot_job_result(job_id: int, body: JobResultIn, db: Session = Depends(get_db)):
    job = db.get(SecurityJob, job_id)
    if not job or job.status != "running":
        raise HTTPException(404, "No running job with that id")
    job.status = "done" if body.ok else "failed"
    job.result = body.result if body.ok else None
    job.error = None if body.ok else (body.error or "Failed")
    job.finished_at = _now()
    db.commit()
    return {"ok": True}


class PullIn(BaseModel):
    source: str = Field(pattern=SNOWFLAKE)
    target: str = Field(pattern=SNOWFLAKE)
    requestedBy: str = Field(default="bot", max_length=40)
    amount: int | None = Field(default=None, ge=1, le=1_000_000)  # None = everyone who consented


@router.post("/bot/pulls", dependencies=[Depends(require_bot)])
def bot_pull_create(body: PullIn, db: Session = Depends(get_db)):
    if body.source == body.target:
        raise HTTPException(400, "Source and target must differ")
    job = sx.create_pull(db, body.source, body.target, f"discord:{body.requestedBy}", body.amount)
    return {"job": sx.pull_out(job)}


class PullStatusIn(BaseModel):
    guildId: str = Field(pattern=SNOWFLAKE)


@router.post("/bot/pulls/status", dependencies=[Depends(require_bot)])
def bot_pull_status(body: PullStatusIn, db: Session = Depends(get_db)):
    jobs = db.scalars(
        select(PullJob).where(or_(PullJob.source_guild == body.guildId, PullJob.target_guild == body.guildId)).order_by(PullJob.created_at.desc()).limit(8)
    ).all()
    return {"jobs": [sx.pull_out(j) for j in jobs], "verified": sx.verified_count(db, body.guildId)}
