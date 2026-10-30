"""Universal stock-file parser.

Auto-detects the layout of each .txt file, caches the result in
data/formats.json, and returns full multi-line entries.

Supported formats:
  A) line            – one entry per line
  B) blank_separated – entries separated by blank lines
  C) dash_separated  – entries separated by --- or ===
  D) numbered        – 1. …, 2. …
  E) pipe_fields     – a | b | c  on one line
  F) key_value_block – key:value blocks separated by --- or blank lines
  G) comma_fields    – a, b, c  on one line
  H) tab_fields      – a\\tb\\tc  on one line
  I) url_per_line    – one URL per line
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Optional

log = logging.getLogger("vendingx.parser")

FORMATS_FILE: Path = Path("data/formats.json")

VALID_FORMATS = (
    "line",
    "blank_separated",
    "dash_separated",
    "numbered",
    "pipe_fields",
    "key_value_block",
    "comma_fields",
    "tab_fields",
    "url_per_line",
)

_RE_NUMBERED = re.compile(r"^\d+[\.\)]\s")
_RE_DASH_SEP = re.compile(r"^-{3,}$|^={3,}$")
_RE_KEY_VALUE = re.compile(r"^[A-Za-z_][\w\s]*:\s*.+")
_RE_URL = re.compile(r"^https?://\S+$")


def _load_format_cache() -> dict:
    """Load the cached format-detection results."""
    if FORMATS_FILE.exists():
        try:
            return json.loads(FORMATS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_format_cache(cache: dict) -> None:
    """Persist the format cache to disk."""
    FORMATS_FILE.parent.mkdir(parents=True, exist_ok=True)
    FORMATS_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def set_format(stock_type: str, fmt: str) -> bool:
    """Manually override the detected format for a stock type."""
    if fmt not in VALID_FORMATS:
        return False
    cache = _load_format_cache()
    cache[stock_type] = fmt
    _save_format_cache(cache)
    return True


def get_format(stock_type: str) -> Optional[str]:
    """Return the cached format for a stock type, or None."""
    return _load_format_cache().get(stock_type)


def detect_format(raw: str) -> str:
    """Heuristically detect the layout of *raw* text content."""
    lines = raw.split("\n")
    non_empty = [l for l in lines if l.strip()]

    if not non_empty:
        return "line"

    has_blank_blocks = "\n\n" in raw.strip()
    has_dash_seps = any(_RE_DASH_SEP.match(l.strip()) for l in lines)
    has_key_value = sum(1 for l in non_empty if _RE_KEY_VALUE.match(l.strip()))

    if has_dash_seps and has_key_value >= 2:
        return "key_value_block"

    if has_dash_seps:
        return "dash_separated"

    if has_blank_blocks:
        kv_in_blocks = False
        for block in re.split(r"\n\s*\n", raw.strip()):
            block_lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
            if len(block_lines) >= 2 and all(_RE_KEY_VALUE.match(bl) for bl in block_lines):
                kv_in_blocks = True
                break
        if kv_in_blocks:
            return "key_value_block"
        return "blank_separated"

    if all(_RE_NUMBERED.match(l.strip()) for l in non_empty):
        return "numbered"

    if all(_RE_URL.match(l.strip()) for l in non_empty):
        return "url_per_line"

    if len(non_empty) >= 2 and all("\t" in l for l in non_empty):
        return "tab_fields"

    if len(non_empty) >= 2 and all("|" in l for l in non_empty):
        return "pipe_fields"

    if len(non_empty) >= 2 and all("," in l for l in non_empty):
        return "comma_fields"

    return "line"


def parse_entries(raw: str, fmt: str) -> list[str]:
    """Split *raw* into individual entries using the given format."""
    if not raw.strip():
        return []

    if fmt == "blank_separated":
        blocks = re.split(r"\n\s*\n", raw.strip())
        return [b.strip() for b in blocks if b.strip()]

    if fmt == "dash_separated":
        blocks = re.split(r"\n-{3,}\n|\n={3,}\n", raw.strip())
        return [b.strip() for b in blocks if b.strip()]

    if fmt == "key_value_block":
        blocks = re.split(r"\n-{3,}\n|\n={3,}\n|\n\s*\n", raw.strip())
        return [b.strip() for b in blocks if b.strip()]

    if fmt == "numbered":
        entries: list[str] = []
        current: list[str] = []
        for line in raw.strip().split("\n"):
            stripped = line.strip()
            if not stripped:
                continue
            if _RE_NUMBERED.match(stripped):
                if current:
                    entries.append("\n".join(current))
                current = [_RE_NUMBERED.sub("", stripped, count=1).strip()]
            else:
                current.append(stripped)
        if current:
            entries.append("\n".join(current))
        return entries

    # line, pipe_fields, comma_fields, tab_fields, url_per_line
    return [l.strip() for l in raw.strip().split("\n") if l.strip()]


def auto_parse(stock_type: str, raw: str) -> list[str]:
    """Detect (or recall) format, then parse."""
    cache = _load_format_cache()
    fmt = cache.get(stock_type)

    if fmt is None:
        fmt = detect_format(raw)
        cache[stock_type] = fmt
        _save_format_cache(cache)
        log.info("Auto-detected format for '%s': %s", stock_type, fmt)

    return parse_entries(raw, fmt)


def preview_entries(stock_type: str, raw: str, count: int = 3) -> tuple[str, list[str]]:
    """Return (format_name, first *count* parsed entries) for admin preview."""
    cache = _load_format_cache()
    fmt = cache.get(stock_type) or detect_format(raw)
    entries = parse_entries(raw, fmt)
    return fmt, entries[:count]
