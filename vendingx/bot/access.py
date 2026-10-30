"""Access control: role, payment, or server-boost grants.

Three paths grant vending access:
  1. User has PREMIUM_ROLE_ID in MAIN_SERVER_ID
  2. User completed a $3 Stripe checkout (one-time)
  3. User has an active server boost (premium_since is set)

The owner (BOT_OWNER_ID) always has access.
"""

from __future__ import annotations

import logging
import os
import sqlite3
import time
from datetime import datetime, timezone
from typing import Optional

import discord

log = logging.getLogger("vendingx.access")

BOT_OWNER_ID = int(os.getenv("BOT_OWNER_ID", "1302203907782606880"))
PREMIUM_ROLE_ID = int(os.getenv("PREMIUM_ROLE_ID", "1474136325912399994"))
MAIN_SERVER_ID = int(os.getenv("MAIN_SERVER_ID", "1344385779627069541"))

COOLDOWN_SECONDS = 5


def check_role(bot: discord.Client, user_id: int) -> bool:
    """Return True if the user has the premium role in the main guild."""
    guild = bot.get_guild(MAIN_SERVER_ID)
    if not guild:
        return False
    member = guild.get_member(user_id)
    if not member:
        return False
    role = guild.get_role(PREMIUM_ROLE_ID)
    return role in member.roles if role else False


def check_boost(bot: discord.Client, user_id: int) -> bool:
    """Return True if the user is boosting the main guild."""
    guild = bot.get_guild(MAIN_SERVER_ID)
    if not guild:
        return False
    member = guild.get_member(user_id)
    if not member:
        return False
    return member.premium_since is not None


def check_payment(db: sqlite3.Connection, user_id: int) -> bool:
    """Return True if a valid payment grant exists."""
    row = db.execute(
        "SELECT 1 FROM access_grants WHERE user_id = ? AND source = 'payment' "
        "AND (expires_at IS NULL OR expires_at > ?) LIMIT 1",
        (user_id, datetime.now(timezone.utc).isoformat()),
    ).fetchone()
    return row is not None


def has_access(bot: discord.Client, db: sqlite3.Connection, user_id: int) -> bool:
    """Return True if the user may vend (any of the three paths, or owner)."""
    if user_id == BOT_OWNER_ID:
        return True
    return (
        check_role(bot, user_id)
        or check_payment(db, user_id)
        or check_boost(bot, user_id)
    )


def grant_payment(db: sqlite3.Connection, user_id: int) -> None:
    """Record a payment-based access grant (no expiry)."""
    db.execute(
        "INSERT INTO access_grants (user_id, source, granted_at) VALUES (?, 'payment', ?)",
        (user_id, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    log.info("Payment access granted to user %s", user_id)


def sync_role_grants(bot: discord.Client, db: sqlite3.Connection) -> int:
    """Sync role-based grants from the live guild member list.  Returns count."""
    guild = bot.get_guild(MAIN_SERVER_ID)
    if not guild:
        return 0
    role = guild.get_role(PREMIUM_ROLE_ID)
    if not role:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for member in role.members:
        db.execute(
            "INSERT OR IGNORE INTO access_grants (user_id, source, granted_at) "
            "VALUES (?, 'role', ?)",
            (member.id, now),
        )
        count += 1
    db.commit()
    return count


def sync_boost_grants(bot: discord.Client, db: sqlite3.Connection) -> int:
    """Sync boost-based grants from the live guild.  Returns count."""
    guild = bot.get_guild(MAIN_SERVER_ID)
    if not guild:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for member in guild.premium_subscribers:
        db.execute(
            "INSERT OR IGNORE INTO access_grants (user_id, source, granted_at) "
            "VALUES (?, 'boost', ?)",
            (member.id, now),
        )
        count += 1
    db.commit()
    return count


class CooldownTracker:
    """Per-user cooldown tracker with separate bot/web counters."""

    def __init__(self) -> None:
        self._bot: dict[int, float] = {}
        self._web: dict[int, float] = {}

    def check(self, user_id: int, source: str = "bot") -> tuple[bool, int]:
        """Return (on_cooldown, seconds_remaining)."""
        store = self._bot if source == "bot" else self._web
        last = store.get(user_id, 0)
        elapsed = time.time() - last
        if elapsed < COOLDOWN_SECONDS:
            return True, int(COOLDOWN_SECONDS - elapsed)
        return False, 0

    def set(self, user_id: int, source: str = "bot") -> None:
        """Mark the current time as the last vend for this user."""
        store = self._bot if source == "bot" else self._web
        store[user_id] = time.time()


cooldowns = CooldownTracker()
