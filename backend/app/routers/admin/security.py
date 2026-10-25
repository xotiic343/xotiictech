"""Security X control panel API (/xotiic -> Security X). Admin session + CSRF + IP allowlist, like the
rest of /xotiic. Actions are queued for the bot and this waits for its answer."""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import AdminContext, require_admin
from app.db import get_db
from app.models import PullJob, SecurityGuild, SecurityLog, SecurityMember
from app.services import security as sx
from app.services.audit import audit

router = APIRouter(prefix="/admin/security", tags=["admin-security"])

ONLINE_WINDOW = timedelta(minutes=3)
ACTIONS = {
    "config.patch", "verify.panel", "jail.setup", "jail", "unjail", "ban", "unban", "kick", "timeout",
    "warnings.clear", "raidmode", "whitelist.add", "whitelist.remove",
    "backup.create", "backup.delete", "backup.preview", "backup.restore",
}


def _online(g: SecurityGuild) -> bool:
    updated = g.updated_at if g.updated_at.tzinfo else g.updated_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - updated < ONLINE_WINDOW


def _guild(db: Session, guild_id: str) -> SecurityGuild:
    g = db.get(SecurityGuild, guild_id)
    if not g:
        raise HTTPException(404, "Security X is not in that server (or hasn't reported yet)")
    return g


@router.get("/guilds")
def list_guilds(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    counts = dict(
        db.execute(
            select(SecurityMember.guild_id, func.count()).where(SecurityMember.revoked.is_(False)).group_by(SecurityMember.guild_id)
        ).all()
    )
    rows = db.scalars(select(SecurityGuild).order_by(SecurityGuild.name)).all()
    return {
        "configured": {
            "bot_secret": bool(settings.security_bot_secret),
            "bot_token": bool(settings.security_bot_token),
            "oauth": sx.oauth_configured(),
        },
        "items": [
            {
                "id": g.guild_id, "name": g.name, "icon": g.icon_url, "members": g.member_count,
                "online": _online(g), "updated_at": g.updated_at.isoformat(),
                "verified": counts.get(g.guild_id, 0),
                "raidmode": bool((((g.state or {}).get("config") or {}).get("raidmode") or {}).get("active")),
                "modules": ((g.state or {}).get("config") or {}).get("modules") or {},
            }
            for g in rows
        ],
    }


@router.get("/guilds/{guild_id}")
def get_guild(guild_id: str, db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    g = _guild(db, guild_id)
    return {
        "id": g.guild_id, "name": g.name, "icon": g.icon_url, "members": g.member_count,
        "online": _online(g), "updated_at": g.updated_at.isoformat(),
        "verified": sx.verified_count(db, g.guild_id),
        "verify_url": f"{settings.frontend_url.rstrip('/')}/security/verify?g={g.guild_id}",
        "state": g.state or {},
    }


@router.get("/guilds/{guild_id}/logs")
def guild_logs(
    guild_id: str,
    after: int = 0,
    type: str | None = Query(default=None, max_length=20),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: AdminContext = Depends(require_admin),
):
    """after=0: the latest `limit` entries. after=N: only entries newer than id N (live polling)."""
    q = select(SecurityLog).where(SecurityLog.guild_id == guild_id)
    if type:
        q = q.where(SecurityLog.type == type)
    if after:
        rows = db.scalars(q.where(SecurityLog.id > after).order_by(SecurityLog.id).limit(limit)).all()
    else:
        rows = list(reversed(db.scalars(q.order_by(SecurityLog.id.desc()).limit(limit)).all()))
    return {
        "items": [{"id": r.id, "type": r.type, "summary": r.summary, "data": r.data, "at": r.created_at.isoformat()} for r in rows],
    }


@router.get("/guilds/{guild_id}/members")
def guild_members(
    guild_id: str,
    q: str = Query(default="", max_length=100),
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
    _: AdminContext = Depends(require_admin),
):
    """Members who verified and consented to backup pulls. Tokens are never returned."""
    query = select(SecurityMember).where(SecurityMember.guild_id == guild_id, SecurityMember.revoked.is_(False))
    if q:
        query = query.where((SecurityMember.username.ilike(f"%{q}%")) | (SecurityMember.user_id == q))
    rows = db.scalars(query.order_by(SecurityMember.consented_at.desc()).offset((page - 1) * 50).limit(50)).all()
    return {
        "total": sx.verified_count(db, guild_id),
        "items": [{"user_id": m.user_id, "username": m.username, "avatar": m.avatar, "consented_at": m.consented_at.isoformat()} for m in rows],
    }


@router.delete("/guilds/{guild_id}/members/{user_id}", status_code=204)
def revoke_member(guild_id: str, user_id: str, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    """Forget a member's consent and tokens (they won't be pulled anymore)."""
    m = db.scalar(select(SecurityMember).where(SecurityMember.guild_id == guild_id, SecurityMember.user_id == user_id))
    if m:
        sx._revoke(m)
        audit(db, admin.username, "security.consent_revoke", "security_member", user_id, {"guild": guild_id}, ip=admin.ip)
        db.commit()


class ActionIn(BaseModel):
    kind: str = Field(max_length=40)
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/guilds/{guild_id}/action")
def guild_action(guild_id: str, body: ActionIn, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    if body.kind not in ACTIONS:
        raise HTTPException(400, "Unknown action")
    g = _guild(db, guild_id)
    if not _online(g):
        raise HTTPException(503, "Security X is offline right now, so it can't do that. Check Discloud.")
    job = sx.enqueue(db, guild_id, body.kind, body.payload)
    audit(db, admin.username, f"security.{body.kind}", "security_guild", guild_id, {"payload": body.payload}, ip=admin.ip)
    db.commit()
    result = sx.wait_for(job.id, timeout=25)
    if not result or result.status == "expired":
        raise HTTPException(504, "The bot didn't answer in time. Try again.")
    if result.status == "failed":
        raise HTTPException(422, result.error or "The bot couldn't do that.")
    if result.status != "done":
        raise HTTPException(504, "The bot is still working on it. Refresh in a moment.")
    return {"ok": True, "result": result.result or {}}


class PullCreateIn(BaseModel):
    source: str = Field(pattern=r"^\d{5,25}$")
    target: str = Field(pattern=r"^\d{5,25}$")


@router.get("/pulls")
def list_pulls(guild: str | None = None, db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    q = select(PullJob).order_by(PullJob.created_at.desc()).limit(50)
    if guild:
        q = q.where((PullJob.source_guild == guild) | (PullJob.target_guild == guild))
    names = {g.guild_id: g.name for g in db.scalars(select(SecurityGuild))}
    return {
        "worker_ready": bool(settings.security_bot_token and sx.oauth_configured()),
        "items": [{**sx.pull_out(j), "source_name": names.get(j.source_guild), "target_name": names.get(j.target_guild)} for j in db.scalars(q)],
    }


@router.post("/pulls", status_code=201)
def create_pull(body: PullCreateIn, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    if body.source == body.target:
        raise HTTPException(400, "Source and target must be different servers")
    if not settings.security_bot_token:
        raise HTTPException(503, "SECURITY_BOT_TOKEN is not set on the API, so members can't be added")
    target = db.get(SecurityGuild, body.target)
    if not target:
        raise HTTPException(400, "Security X is not in the target server. Invite it there first.")
    job = sx.create_pull(db, body.source, body.target, f"panel:{admin.username}")
    audit(db, admin.username, "security.pull_create", "security_pull", job.id, {"source": body.source, "target": body.target}, ip=admin.ip)
    db.commit()
    return sx.pull_out(job)


@router.post("/pulls/{pull_id}/cancel")
def cancel_pull(pull_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    job = db.get(PullJob, pull_id)
    if not job:
        raise HTTPException(404, "Pull not found")
    if job.status in ("queued", "running"):
        job.status = "cancelled"
        job.finished_at = datetime.now(timezone.utc)
        audit(db, admin.username, "security.pull_cancel", "security_pull", job.id, None, ip=admin.ip)
        db.commit()
    return sx.pull_out(job)
