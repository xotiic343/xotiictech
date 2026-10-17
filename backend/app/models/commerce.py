import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

PRODUCT_CATEGORIES = ("source_code", "discord_bots", "minecraft_clients", "pc_applications")
SELL_TYPES = ("download", "source_code", "license", "hosted", "custom_build")


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    tagline: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    features: Mapped[list] = mapped_column(JSON, default=list)
    category: Mapped[str] = mapped_column(String(32), index=True)
    sell_type: Mapped[str] = mapped_column(String(32), default="download")
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    media: Mapped[list] = mapped_column(JSON, default=list)  # [{type: image|video, url, alt}]
    deliverable_key: Mapped[str | None] = mapped_column(String(500))  # private bucket object key
    deliverable_filename: Mapped[str | None] = mapped_column(String(255))
    version: Mapped[str | None] = mapped_column(String(40))
    changelog: Mapped[str | None] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    bot_id: Mapped[int | None] = mapped_column(ForeignKey("bots.id", ondelete="SET NULL"), index=True)
    sales_count: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    bot = relationship("Bot", lazy="joined")


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), index=True)
    product_name: Mapped[str] = mapped_column(String(160))  # snapshot at purchase time
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending|paid|refunded|failed
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    stripe_payment_intent: Mapped[str | None] = mapped_column(String(255), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    download_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    last_emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refund_notes: Mapped[str | None] = mapped_column(Text)
    admin_notes: Mapped[str | None] = mapped_column(Text)
    # hosted bots (manual v1): none | requested | approved | deployed | rejected
    hosting_status: Mapped[str] = mapped_column(String(16), default="none")
    hosting_server_id: Mapped[str | None] = mapped_column(String(32))

    product = relationship("Product", lazy="joined")
