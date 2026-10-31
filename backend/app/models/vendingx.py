from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, utcnow


class VendingStock(Base):
    """One row per stock type (epicgames, steam, premium_nitro, etc.)."""

    __tablename__ = "vending_stock_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300), default="")
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    icon_url: Mapped[str | None] = mapped_column(String(1000))


class VendingItem(TimestampMixin, Base):
    """Individual dispensable items. Each row is one account/token/link."""

    __tablename__ = "vending_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stock_key: Mapped[str] = mapped_column(String(80), index=True)
    content: Mapped[str] = mapped_column(Text)
    # "bot" rows mirror the Discord bot's stock files and are reconciled on every sync; "admin" rows were
    # uploaded in the admin panel and only exist here.
    origin: Mapped[str] = mapped_column(String(10), default="bot", server_default="bot")
    dispensed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    dispensed_to: Mapped[str | None] = mapped_column(String(80))
    dispensed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VendingLog(Base):
    """Audit log of all vends."""

    __tablename__ = "vending_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    username: Mapped[str] = mapped_column(String(120), default="")
    stock_key: Mapped[str] = mapped_column(String(80))
    stock_name: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(20), default="WEB")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
