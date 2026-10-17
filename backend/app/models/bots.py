from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utcnow


class Bot(TimestampMixin, Base):
    """A Discord bot. Synced columns are overwritten on every sync; override columns never are."""

    __tablename__ = "bots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # ---- synced from Discord ----
    discord_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    application_id: Mapped[str | None] = mapped_column(String(32))
    username: Mapped[str] = mapped_column(String(100))
    avatar_hash: Mapped[str | None] = mapped_column(String(64))
    banner_hash: Mapped[str | None] = mapped_column(String(64))
    app_description: Mapped[str | None] = mapped_column(Text)
    app_tags: Mapped[list] = mapped_column(JSON, default=list)
    bot_public: Mapped[bool] = mapped_column(Boolean, default=True)
    guild_count: Mapped[int] = mapped_column(Integer, default=0)
    install_scopes: Mapped[list] = mapped_column(JSON, default=list)
    install_permissions: Mapped[str | None] = mapped_column(String(32))
    custom_install_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default="offline")  # online | offline
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # ---- admin overrides (take precedence over synced data) ----
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    short_description: Mapped[str | None] = mapped_column(String(300))
    long_description: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list | None] = mapped_column(JSON)  # None = fall back to app_tags
    category: Mapped[str | None] = mapped_column(String(60))
    pricing_type: Mapped[str] = mapped_column(String(16), default="free")  # free | premium | custom
    price_label: Mapped[str | None] = mapped_column(String(60))
    media: Mapped[list] = mapped_column(JSON, default=list)  # [{type,url,alt}]
    support_url: Mapped[str | None] = mapped_column(String(500))
    website_url: Mapped[str | None] = mapped_column(String(500))
    invite_permissions: Mapped[str | None] = mapped_column(String(32))
    version: Mapped[str | None] = mapped_column(String(40))
    changelog: Mapped[str | None] = mapped_column(Text)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    commands: Mapped[list["BotCommand"]] = relationship(
        back_populates="bot", cascade="all, delete-orphan", order_by="BotCommand.name"
    )

    # ---- derived helpers ----
    @property
    def name(self) -> str:
        return self.display_name or self.username

    @property
    def effective_tags(self) -> list[str]:
        return list(self.tags if self.tags is not None else (self.app_tags or []))

    @property
    def description(self) -> str:
        return self.short_description or (self.app_description or "")[:300]

    @property
    def avatar_url(self) -> str:
        if self.avatar_hash:
            ext = "gif" if self.avatar_hash.startswith("a_") else "png"
            return f"https://cdn.discordapp.com/avatars/{self.discord_id}/{self.avatar_hash}.{ext}?size=256"
        try:
            idx = (int(self.discord_id) >> 22) % 6
        except ValueError:
            idx = 0
        return f"https://cdn.discordapp.com/embed/avatars/{idx}.png"

    @property
    def banner_url(self) -> str | None:
        if not self.banner_hash:
            return None
        ext = "gif" if self.banner_hash.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/banners/{self.discord_id}/{self.banner_hash}.{ext}?size=1024"

    @property
    def invite_url(self) -> str | None:
        if self.custom_install_url and not self.invite_permissions:
            return self.custom_install_url
        client_id = self.application_id or self.discord_id
        scopes = self.install_scopes or ["bot", "applications.commands"]
        perms = self.invite_permissions or self.install_permissions or "0"
        return (
            "https://discord.com/oauth2/authorize"
            f"?client_id={client_id}&scope={'%20'.join(scopes)}&permissions={perms}"
        )


class BotCommand(Base):
    __tablename__ = "bot_commands"
    __table_args__ = (UniqueConstraint("bot_id", "discord_command_id", name="uq_bot_commands_bot_cmd"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bot_id: Mapped[int] = mapped_column(ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    discord_command_id: Mapped[str] = mapped_column(String(32))
    guild_id: Mapped[str | None] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(300))
    type: Mapped[int] = mapped_column(Integer, default=1)  # 1 slash, 2 user, 3 message
    options: Mapped[list] = mapped_column(JSON, default=list)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    bot: Mapped[Bot] = relationship(back_populates="commands")


class DiscordToken(Base):
    """Health record for one configured token. The raw token lives ONLY in env vars."""

    __tablename__ = "discord_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True)  # sha256(token)
    masked_hint: Mapped[str] = mapped_column(String(32))  # e.g. "token #2 (…f3Qa)"
    env_position: Mapped[int | None] = mapped_column(Integer)
    bot_discord_id: Mapped[str | None] = mapped_column(String(32))
    bot_username: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16), default="unknown")  # healthy|invalid|error|removed|unknown
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BotSyncLog(Base):
    __tablename__ = "bot_sync_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trigger: Mapped[str] = mapped_column(String(16))  # scheduled | manual | startup
    status: Mapped[str] = mapped_column(String(16), default="running")  # running|success|partial|failed|skipped
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bots_seen: Mapped[int] = mapped_column(Integer, default=0)
    bots_new: Mapped[int] = mapped_column(Integer, default=0)
    bots_failed: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)


class BotInquiry(TimestampMixin, Base):
    __tablename__ = "bot_inquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    discord_username: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(320))
    server_size: Mapped[str] = mapped_column(String(40))
    purpose: Mapped[str] = mapped_column(Text)
    features: Mapped[str] = mapped_column(Text)
    budget: Mapped[str] = mapped_column(String(60))
    timeline: Mapped[str] = mapped_column(String(60))
    reference_bot_id: Mapped[int | None] = mapped_column(ForeignKey("bots.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(16), default="new", index=True)  # new | replied | closed
    admin_notes: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(String(64))


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bot_id: Mapped[int | None] = mapped_column(ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    author_name: Mapped[str] = mapped_column(String(120))
    rating: Mapped[int] = mapped_column(Integer)
    body: Mapped[str] = mapped_column(Text)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
