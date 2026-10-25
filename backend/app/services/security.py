"""Security X backend: token encryption, Discord OAuth for the consent verify page, the bot job queue
and the member-pull worker.

Member pulling only ever adds people who verified on /security/verify and agreed to be added to the
server's backup server (OAuth scope `guilds.join`). Their tokens are encrypted at rest, are only used to
add them to a server, and are deleted when consent is revoked.
"""

import base64
import hashlib
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import PullJob, SecurityJob, SecurityMember

log = logging.getLogger(__name__)

DISCORD_API = "https://discord.com/api/v10"
TOKEN_URL = "https://discord.com/api/oauth2/token"
JOB_MAX_AGE = timedelta(minutes=2)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------------- encryption ----------------


def _fernet() -> Fernet:
    key = settings.security_token_key.strip()
    if not key:
        key = base64.urlsafe_b64encode(hashlib.sha256(f"security-x:{settings.secret_key}".encode()).digest()).decode()
    return Fernet(key)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str | None:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError):
        return None


# ---------------- OAuth (verify page) ----------------


def redirect_uri() -> str:
    return f"{settings.frontend_url.rstrip('/')}/api/security/oauth/callback"


def oauth_configured() -> bool:
    return bool(settings.security_client_id and settings.security_client_secret)


def exchange_code(code: str) -> dict:
    res = httpx.post(
        TOKEN_URL,
        data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri()},
        auth=(settings.security_client_id, settings.security_client_secret),
        timeout=15,
    )
    res.raise_for_status()
    return res.json()


def fetch_user(access_token: str) -> dict:
    res = httpx.get(f"{DISCORD_API}/users/@me", headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
    res.raise_for_status()
    return res.json()


def save_member(db: Session, guild_id: str, user: dict, tokens: dict) -> SecurityMember:
    row = db.scalar(select(SecurityMember).where(SecurityMember.guild_id == guild_id, SecurityMember.user_id == str(user["id"])))
    if row is None:
        row = SecurityMember(guild_id=guild_id, user_id=str(user["id"]))
        db.add(row)
    row.username = (user.get("global_name") or user.get("username") or str(user["id"]))[:100]
    row.avatar = user.get("avatar")
    row.access_token = encrypt(tokens["access_token"])
    row.refresh_token = encrypt(tokens.get("refresh_token") or "")
    row.expires_at = _now() + timedelta(seconds=int(tokens.get("expires_in") or 604800))
    row.consented_at = _now()
    row.revoked = False
    return row


def _revoke(m: SecurityMember) -> None:
    m.revoked = True
    m.access_token = ""
    m.refresh_token = ""


def access_token_for(http: httpx.Client, m: SecurityMember) -> str | None:
    """A valid access token for this member, refreshed when about to expire. None = consent is gone."""
    if m.revoked:
        return None
    if _aware(m.expires_at) > _now() + timedelta(seconds=60):
        token = decrypt(m.access_token)
        if token:
            return token
    refresh = decrypt(m.refresh_token) if m.refresh_token else None
    if not refresh:
        _revoke(m)
        return None
    res = http.post(
        TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": refresh},
        auth=(settings.security_client_id, settings.security_client_secret),
    )
    if res.status_code == 400:  # invalid_grant: the member removed the app's access
        _revoke(m)
        return None
    res.raise_for_status()
    data = res.json()
    m.access_token = encrypt(data["access_token"])
    m.refresh_token = encrypt(data.get("refresh_token") or refresh)
    m.expires_at = _now() + timedelta(seconds=int(data.get("expires_in") or 604800))
    return data["access_token"]


# ---------------- bot job queue ----------------


def enqueue(db: Session, guild_id: str, kind: str, payload: dict) -> SecurityJob:
    job = SecurityJob(kind=kind, guild_id=guild_id, payload={**payload, "guildId": guild_id})
    db.add(job)
    db.commit()
    return job


def wait_for(job_id: int, timeout: float) -> SecurityJob | None:
    """Poll until the bot finishes the job or the timeout passes. Expires it if the bot never picked it up."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        time.sleep(0.6)
        with SessionLocal() as db:
            job = db.get(SecurityJob, job_id)
            if job and job.status in ("done", "failed"):
                return job
    with SessionLocal() as db:
        job = db.get(SecurityJob, job_id)
        if job and job.status == "pending":
            job.status = "expired"
            job.finished_at = _now()
            db.commit()
        return job


def claim_jobs(db: Session, limit: int = 5) -> list[SecurityJob]:
    cutoff = _now() - JOB_MAX_AGE
    for stale in db.scalars(select(SecurityJob).where(SecurityJob.status == "pending", SecurityJob.created_at < cutoff)):
        stale.status = "expired"
        stale.finished_at = _now()
    jobs = db.scalars(select(SecurityJob).where(SecurityJob.status == "pending").order_by(SecurityJob.created_at).limit(limit)).all()
    for job in jobs:
        job.status = "running"
        job.claimed_at = _now()
    db.commit()
    return list(jobs)


# ---------------- member pulls ----------------


def verified_count(db: Session, guild_id: str) -> int:
    return db.scalar(select(func.count()).select_from(SecurityMember).where(SecurityMember.guild_id == guild_id, SecurityMember.revoked.is_(False))) or 0


MAX_PULL = 1_000_000


def create_pull(db: Session, source: str, target: str, requested_by: str, max_members: int | None = None) -> PullJob:
    """Queue a pull. `max_members` caps how many consenting members are pulled (None = all of them)."""
    active = db.scalar(select(PullJob).where(PullJob.source_guild == source, PullJob.target_guild == target, PullJob.status.in_(("queued", "running"))))
    if active:
        return active
    if max_members is not None:
        max_members = max(1, min(int(max_members), MAX_PULL))
    available = verified_count(db, source)
    job = PullJob(
        source_guild=source,
        target_guild=target,
        max_members=max_members,
        total=min(available, max_members) if max_members else available,
        requested_by=requested_by[:120],
    )
    db.add(job)
    db.commit()
    return job


def pull_out(j: PullJob) -> dict:
    return {
        "id": j.id, "source": j.source_guild, "target": j.target_guild, "status": j.status,
        "max_members": j.max_members, "total": j.total, "processed": j.processed, "added": j.added, "already": j.already, "failed": j.failed,
        "error": j.error, "requested_by": j.requested_by,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "finished_at": j.finished_at.isoformat() if j.finished_at else None,
    }


class _Fatal(Exception):
    """Stops the whole pull (bot not in the target, missing permissions)."""


def _add_member(http: httpx.Client, db: Session, target: str, m: SecurityMember) -> str:
    """added | already | failed. Raises _Fatal for problems that affect every member."""
    token = access_token_for(http, m)
    if not token:
        return "failed"
    url = f"{DISCORD_API}/guilds/{target}/members/{m.user_id}"
    headers = {"Authorization": f"Bot {settings.security_bot_token}"}
    for _ in range(3):
        res = http.put(url, headers=headers, json={"access_token": token})
        if res.status_code == 201:
            return "added"
        if res.status_code == 204:
            return "already"
        if res.status_code == 429:
            time.sleep(min(float(res.json().get("retry_after", 1)), 15))
            continue
        code = (res.json() if res.headers.get("content-type", "").startswith("application/json") else {}).get("code")
        if code == 10004 or res.status_code == 404:
            raise _Fatal("The bot is not in the target server.")
        if code == 50013:
            raise _Fatal("The bot is missing permissions in the target server (it needs Create Invite).")
        if code == 50025 or res.status_code == 401:  # member's token is no longer valid
            _revoke(m)
        return "failed"  # e.g. 30001: the member is already in 100 servers
    return "failed"


_pull_lock = threading.Lock()


def run_pulls() -> None:
    """Scheduler tick (every 10s): work on the oldest queued/running pull for a few seconds."""
    if not settings.security_bot_token or not oauth_configured():
        return
    if not _pull_lock.acquire(blocking=False):
        return
    try:
        with SessionLocal() as db, httpx.Client(timeout=15) as http:
            job = db.scalar(select(PullJob).where(PullJob.status.in_(("queued", "running"))).order_by(PullJob.created_at).limit(1))
            if not job:
                return
            if job.status == "queued":
                job.status = "running"
                db.commit()
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                if job.max_members and job.processed >= job.max_members:  # chosen amount reached
                    job.status = "done"
                    job.finished_at = _now()
                    db.commit()
                    log.info("Pull %s reached its amount (%s): %s added", job.id, job.max_members, job.added)
                    return
                members = db.scalars(
                    select(SecurityMember)
                    .where(SecurityMember.guild_id == job.source_guild, SecurityMember.revoked.is_(False), SecurityMember.id > job.cursor)
                    .order_by(SecurityMember.id)
                    .limit(10)
                ).all()
                if not members:
                    job.status = "done"
                    job.finished_at = _now()
                    db.commit()
                    log.info("Pull %s done: %s added, %s already in, %s failed", job.id, job.added, job.already, job.failed)
                    return
                for m in members:
                    db.refresh(job)
                    if job.status == "cancelled":
                        return
                    if job.max_members and job.processed >= job.max_members:
                        break  # the check at the top of the loop finishes the pull
                    try:
                        outcome = _add_member(http, db, job.target_guild, m)
                    except _Fatal as exc:
                        job.status = "failed"
                        job.error = str(exc)
                        job.finished_at = _now()
                        db.commit()
                        return
                    except httpx.HTTPError as exc:
                        log.warning("Pull %s: network error for %s: %s", job.id, m.user_id, exc)
                        outcome = "failed"
                    job.processed += 1
                    setattr(job, outcome, getattr(job, outcome) + 1)
                    job.cursor = m.id
                    db.commit()
    except Exception:  # never let one bad tick kill the scheduler
        log.exception("Member pull tick failed")
    finally:
        _pull_lock.release()
