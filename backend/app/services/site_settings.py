"""Editable site content and runtime settings, stored in `site_settings` with code defaults."""

from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SiteSetting

CONTENT_DEFAULTS: dict[str, Any] = {
    "hero": {
        "eyebrow": "// XOTIICTECH SYSTEMS ONLINE",
        "title": "XOTIICTECH",
        "subtitle": "Discord bots, game clients and software — engineered in the dark, shipped in red.",
        "terminal_lines": [
            "> booting xotiic.core ...",
            "> loading bots ............ OK",
            "> linking store ........... OK",
            "> ready. build something dangerous.",
        ],
        "primary_cta": {"label": "Enter the store", "href": "/store"},
        "secondary_cta": {"label": "Commission a bot", "href": "/bots/commission"},
    },
    "ticker": {"enabled": True, "items": ["Custom Discord bots built to spec", "Instant digital delivery"]},
    "stats": {"products_sold": None, "bots_deployed": None, "servers_reached": None, "clients": 0},
    "about": {
        "title": "About XotiicTech",
        "body": "XotiicTech builds Discord bots, Minecraft clients and PC software. Every product is built, "
        "tested and supported by a developer who actually uses it.",
    },
    "taglines": ["Built to spec.", "Shipped in red.", "No bloat. No excuses."],
    "socials": {"discord": "", "github": "", "youtube": "", "x": "", "tiktok": ""},
    "footer": {"blurb": "Retro-tech software studio. Bots, clients and tools.", "support_email": ""},
    "free_tools": {
        "enabled": True,
        "headline": "Free tools",
        "items": [
            {
                "name": "R6XScan — Rainbow Six Siege PC Checker",
                "description": "Free scan that checks whether your PC is ready for Rainbow Six Siege: "
                "specs, drivers and common performance issues.",
                "url": "https://r6xscan.vercel.app/",
                "badge": "FREE",
                "featured": True,
            }
        ],
    },
    "legal": {"terms": "", "privacy": "", "refund_policy": "", "licenses": ""},
}

SETTINGS_DEFAULTS: dict[str, Any] = {
    "download_expiry_hours": 48,
    "max_downloads_per_order": 10,
    "discord_sync_interval_minutes": 45,
    "auto_publish_new_bots": False,
    "reviews_require_approval": False,
    "email_order_subject": "Your XotiicTech download: {product}",
    "email_order_body": (
        "Thanks for your purchase of {product}!\n\n"
        "Download link (expires {expires}):\n{link}\n\n"
        "Lost it? Sign in at {account_url} to grab a fresh link.\n\n— XotiicTech"
    ),
    "email_magic_link_subject": "Your XotiicTech sign-in link",
}


def _get_raw(db: Session, key: str) -> Any:
    row = db.get(SiteSetting, key)
    return None if row is None else row.value


def _merge(default: Any, stored: Any) -> Any:
    if isinstance(default, dict) and isinstance(stored, dict):
        out = deepcopy(default)
        out.update(stored)
        return out
    return deepcopy(default) if stored is None else stored


def get_content(db: Session, key: str) -> Any:
    return _merge(CONTENT_DEFAULTS.get(key), _get_raw(db, f"content.{key}"))


def all_content(db: Session) -> dict[str, Any]:
    stored = {
        row.key.removeprefix("content."): row.value
        for row in db.scalars(select(SiteSetting).where(SiteSetting.key.like("content.%")))
    }
    keys = set(CONTENT_DEFAULTS) | set(stored)
    return {k: _merge(CONTENT_DEFAULTS.get(k), stored.get(k)) for k in keys}


def set_content(db: Session, key: str, value: Any) -> None:
    _upsert(db, f"content.{key}", value)


def get_setting(db: Session, key: str) -> Any:
    raw = _get_raw(db, f"settings.{key}")
    return SETTINGS_DEFAULTS.get(key) if raw is None else raw


def all_settings(db: Session) -> dict[str, Any]:
    return {k: get_setting(db, k) for k in SETTINGS_DEFAULTS}


def set_setting(db: Session, key: str, value: Any) -> None:
    _upsert(db, f"settings.{key}", value)


def _upsert(db: Session, key: str, value: Any) -> None:
    row = db.get(SiteSetting, key)
    if row is None:
        db.add(SiteSetting(key=key, value=value))
    else:
        row.value = value
