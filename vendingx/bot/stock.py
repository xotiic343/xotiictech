from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Optional

from bot.parser import auto_parse

log = logging.getLogger("vendingx.stock")

STOCK_DIR = Path("stock")
STOCK_DIR.mkdir(exist_ok=True)

_lock = threading.Lock()


def _path(stock_type: str) -> Path:
    safe = stock_type.lower().strip().replace(" ", "_")
    return STOCK_DIR / f"{safe}.txt"


def ensure_file(stock_type: str) -> Path:
    p = _path(stock_type)
    if not p.exists():
        p.write_text("", encoding="utf-8")
    return p


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(str(tmp), str(path))


def read_entries(stock_type: str) -> list[str]:
    p = _path(stock_type)
    if not p.exists():
        return []
    raw = p.read_text(encoding="utf-8")
    return auto_parse(stock_type, raw)


def count(stock_type: str) -> int:
    return len(read_entries(stock_type))


def count_all(stock_types: dict) -> dict[str, int]:
    return {st: count(st) for st in stock_types}


def dispense(stock_type: str) -> Optional[str]:
    with _lock:
        entries = read_entries(stock_type)
        if not entries:
            return None
        item = entries[0]
        remaining = entries[1:]
        _atomic_write(_path(stock_type), "\n".join(remaining))
        return item


def restore(stock_type: str, entry: str) -> None:
    with _lock:
        entries = read_entries(stock_type)
        entries.insert(0, entry)
        _atomic_write(_path(stock_type), "\n".join(entries))
    log.info("Restored entry to '%s' after failed delivery", stock_type)


def add_entries(stock_type: str, new_entries: list[str]) -> int:
    with _lock:
        ensure_file(stock_type)
        current = read_entries(stock_type)
        current.extend(new_entries)
        _atomic_write(_path(stock_type), "\n".join(current))
        return len(current)


def clear(stock_type: str) -> None:
    with _lock:
        _atomic_write(_path(stock_type), "")
    log.info("Cleared all stock for '%s'", stock_type)
