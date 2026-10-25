"""Security X: data the bot pushes for the /xotiic control panel, consenting members, jobs and pulls."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class SecurityGuild(Base):
    """One Discord server Security X is in. `state` is the bot's latest snapshot (config, jails, cases,
    backups, channels, roles), pushed every minute. `updated_at` doubles as the bot heartbeat."""

    __tablename__ = "security_guilds"

    guild_id: Mapped[str] = mapped_column(String(25), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    icon_url: Mapped[str | None] = mapped_column(String(500))
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    state: Mapped[dict | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, index=True)


class SecurityMember(Base):
    """A member who verified on /security/verify and agreed to be added to the server's backup server.
    Tokens are Fernet-encrypted at rest and never leave the API."""

    __tablename__ = "security_members"
    __table_args__ = (UniqueConstraint("guild_id", "user_id", name="uq_security_members_guild_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    guild_id: Mapped[str] = mapped_column(String(25), index=True)
    user_id: Mapped[str] = mapped_column(String(25), index=True)
    username: Mapped[str] = mapped_column(String(100))
    avatar: Mapped[str | None] = mapped_column(String(200))
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class SecurityLog(Base):
    """Live log feed (mod, alert, join, message, voice) pushed by the bot. Kept for 30 days."""

    __tablename__ = "security_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    guild_id: Mapped[str] = mapped_column(String(25), index=True)
    type: Mapped[str] = mapped_column(String(20), index=True)
    summary: Mapped[str] = mapped_column(String(300))
    data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class SecurityJob(Base):
    """An action from the panel or the verify page for the bot. The bot (on Discloud) can't receive
    requests, so it polls /api/security/bot/jobs and posts results back."""

    __tablename__ = "security_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(40))
    guild_id: Mapped[str] = mapped_column(String(25), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending|running|done|failed|expired
    result: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PullJob(Base):
    """Adds consenting members of `source_guild` into `target_guild`. Resumable: `cursor` is the last
    SecurityMember.id processed, so a restart continues where it stopped."""

    __tablename__ = "security_pulls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_guild: Mapped[str] = mapped_column(String(25), index=True)
    target_guild: Mapped[str] = mapped_column(String(25), index=True)
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # queued|running|done|failed|cancelled
    max_members: Mapped[int | None] = mapped_column(Integer)  # pull at most this many (None = everyone who consented)
    total: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    added: Mapped[int] = mapped_column(Integer, default=0)
    already: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    cursor: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    requested_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
