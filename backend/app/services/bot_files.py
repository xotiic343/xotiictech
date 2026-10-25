"""Bot info written by hand in backend/my-bots/, applied on every Discord sync.

Discord only knows a bot's name, a one-line app description and its command list. Everything else that
makes a bot page accurate (a real description, tags, pricing, links, version) lives in one folder per bot:

    backend/my-bots/<any-folder-name>/bot.json        required: which bot + its details
    backend/my-bots/<any-folder-name>/description.md  optional: long description (Markdown)
    backend/my-bots/<any-folder-name>/changelog.md    optional: changelog (Markdown)

Folders starting with "_" (like _template) are ignored. A field you leave out of bot.json is not touched,
so it can still be edited in /xotiic. A field you set here wins over /xotiic on the next sync.
A broken file is logged and skipped. It never stops the sync.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.models import Bot

log = logging.getLogger(__name__)

BOTS_DIR = Path(__file__).resolve().parents[2] / "my-bots"


class BotFile(BaseModel):
    model_config = ConfigDict(extra="forbid")  # a typo in a field name is reported, not silently ignored

    # which bot this file is for: the bot's user ID or its application ID (Developer Portal -> General Information)
    discord_id: str | None = Field(default=None, pattern=r"^\d{5,25}$")
    application_id: str | None = Field(default=None, pattern=r"^\d{5,25}$")

    name: str | None = Field(default=None, max_length=100)
    short_description: str | None = Field(default=None, max_length=300)
    tags: list[str] | None = None
    category: str | None = Field(default=None, max_length=60)
    pricing_type: Literal["free", "premium", "custom"] | None = None
    price_label: str | None = Field(default=None, max_length=60)
    support_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    version: str | None = Field(default=None, max_length=40)
    featured: bool | None = None


def _read_md(folder: Path, name: str) -> str | None:
    p = folder / name
    if not p.is_file():
        return None
    text = p.read_text(encoding="utf-8").strip()
    return text or None


def load_bot_files() -> list[tuple[BotFile, str | None, str | None]]:
    """(bot.json, description.md, changelog.md) for every bot folder. Bad folders are logged and skipped."""
    out: list[tuple[BotFile, str | None, str | None]] = []
    if not BOTS_DIR.is_dir():
        return out
    for folder in sorted(BOTS_DIR.iterdir()):
        if not folder.is_dir() or folder.name.startswith(("_", ".")):
            continue
        cfg = folder / "bot.json"
        if not cfg.is_file():
            log.warning("my-bots/%s has no bot.json; skipped", folder.name)
            continue
        try:
            data = BotFile.model_validate(json.loads(cfg.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, ValidationError) as exc:
            log.warning("my-bots/%s/bot.json is invalid; skipped: %s", folder.name, exc)
            continue
        if not data.discord_id and not data.application_id:
            log.warning("my-bots/%s/bot.json needs discord_id or application_id; skipped", folder.name)
            continue
        out.append((data, _read_md(folder, "description.md"), _read_md(folder, "changelog.md")))
    return out


def apply_bot_file(bot: Bot, files: list[tuple[BotFile, str | None, str | None]]) -> bool:
    """Copy the matching folder's values onto the bot's override columns. Returns True if one matched."""
    for f, description, changelog in files:
        if f.discord_id != bot.discord_id and f.application_id != bot.application_id:
            continue
        if f.name is not None:
            bot.display_name = f.name
        if f.short_description is not None:
            bot.short_description = f.short_description
        if f.tags is not None:
            bot.tags = [t.strip() for t in f.tags if t.strip()][:12]
        if f.category is not None:
            bot.category = f.category
        if f.pricing_type is not None:
            bot.pricing_type = f.pricing_type
        if f.price_label is not None:
            bot.price_label = f.price_label
        if f.support_url is not None:
            bot.support_url = f.support_url
        if f.website_url is not None:
            bot.website_url = f.website_url
        if f.version is not None:
            bot.version = f.version
        if f.featured is not None:
            bot.is_featured = f.featured
        if description is not None:
            bot.long_description = description
        if changelog is not None:
            bot.changelog = changelog
        return True
    return False
