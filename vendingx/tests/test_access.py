"""Tests for bot.access — access control logic."""

import sqlite3
import time
from datetime import datetime, timezone
from unittest.mock import MagicMock, PropertyMock

import pytest
from bot.access import (
    CooldownTracker,
    check_payment,
    grant_payment,
    BOT_OWNER_ID,
)


@pytest.fixture
def db():
    """In-memory SQLite database with the access_grants table."""
    conn = sqlite3.connect(":memory:")
    conn.execute("""CREATE TABLE access_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('role','payment','boost')),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
    )""")
    conn.commit()
    return conn


class TestCheckPayment:
    """Payment grant lookups."""

    def test_no_grant(self, db):
        assert check_payment(db, 12345) is False

    def test_with_grant(self, db):
        grant_payment(db, 12345)
        assert check_payment(db, 12345) is True

    def test_expired_grant(self, db):
        db.execute(
            "INSERT INTO access_grants (user_id, source, granted_at, expires_at) VALUES (?, 'payment', ?, ?)",
            (12345, "2020-01-01T00:00:00+00:00", "2020-01-02T00:00:00+00:00"),
        )
        db.commit()
        assert check_payment(db, 12345) is False

    def test_no_expiry_means_permanent(self, db):
        grant_payment(db, 99999)
        assert check_payment(db, 99999) is True


class TestCooldownTracker:
    """Per-user cooldown logic."""

    def test_no_cooldown_initially(self):
        tracker = CooldownTracker()
        on_cd, remaining = tracker.check(1, "bot")
        assert on_cd is False
        assert remaining == 0

    def test_cooldown_after_set(self):
        tracker = CooldownTracker()
        tracker.set(1, "bot")
        on_cd, remaining = tracker.check(1, "bot")
        assert on_cd is True
        assert remaining > 0

    def test_bot_and_web_are_separate(self):
        tracker = CooldownTracker()
        tracker.set(1, "bot")
        on_cd_web, _ = tracker.check(1, "web")
        on_cd_bot, _ = tracker.check(1, "bot")
        assert on_cd_web is False
        assert on_cd_bot is True

    def test_different_users_independent(self):
        tracker = CooldownTracker()
        tracker.set(1, "bot")
        on_cd, _ = tracker.check(2, "bot")
        assert on_cd is False


class TestGrantPayment:
    """Payment grant creation."""

    def test_grant_creates_row(self, db):
        grant_payment(db, 42)
        row = db.execute("SELECT user_id, source FROM access_grants WHERE user_id = 42").fetchone()
        assert row is not None
        assert row[0] == 42
        assert row[1] == "payment"

    def test_multiple_grants_allowed(self, db):
        grant_payment(db, 42)
        grant_payment(db, 42)
        count = db.execute("SELECT COUNT(*) FROM access_grants WHERE user_id = 42").fetchone()[0]
        assert count == 2
