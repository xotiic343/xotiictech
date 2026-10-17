import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session


def slugify(value: str, max_len: int = 100) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value[:max_len].strip("-") or "item"


def unique_slug(db: Session, model, base: str, exclude_id: int | None = None) -> str:
    base = slugify(base)
    candidate, n = base, 2
    while True:
        q = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            q = q.where(model.id != exclude_id)
        if db.scalar(q) is None:
            return candidate
        candidate, n = f"{base}-{n}", n + 1
