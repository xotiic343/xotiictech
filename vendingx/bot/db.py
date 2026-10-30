"""Database initialisation and access.

Uses SQLite in WAL mode with parameterized queries only.
"""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

log = logging.getLogger("vendingx.db")

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "vendingx.db"

_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    username        TEXT,
    coins           INTEGER DEFAULT 0,
    total_generated INTEGER DEFAULT 0,
    last_generated  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_usage (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    stock_type     TEXT    NOT NULL,
    stock_content  TEXT,
    source         TEXT    DEFAULT 'BOT' CHECK(source IN ('BOT','WEB')),
    server_id      INTEGER,
    generated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_cooldowns (
    user_id       INTEGER PRIMARY KEY,
    last_bot_vend REAL DEFAULT 0,
    last_web_vend REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS banned_users (
    user_id   INTEGER PRIMARY KEY,
    reason    TEXT,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vending_configs (
    server_id              INTEGER PRIMARY KEY,
    log_channel_id         INTEGER,
    announce_channel_id    INTEGER,
    announce_role_id       INTEGER,
    auto_update_channel_id INTEGER,
    auto_update_role_id    INTEGER
);

CREATE TABLE IF NOT EXISTS access_grants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    source     TEXT    NOT NULL CHECK(source IN ('role','payment','boost')),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS web_sessions (
    session_id            TEXT PRIMARY KEY,
    user_id               INTEGER NOT NULL,
    discord_username      TEXT,
    discord_avatar        TEXT,
    discord_access_token  TEXT,
    discord_refresh_token TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at            TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stripe_payments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL,
    stripe_session_id TEXT UNIQUE,
    amount            INTEGER,
    status            TEXT DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def init_db() -> sqlite3.Connection:
    """Create or open the database, apply schema, enable WAL."""
    global _conn
    _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.executescript(SCHEMA)
    _conn.commit()
    log.info("Database ready at %s", DB_PATH)
    return _conn


def get_db() -> sqlite3.Connection:
    """Return the shared database connection, initialising if needed."""
    global _conn
    if _conn is None:
        return init_db()
    return _conn
