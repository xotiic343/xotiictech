"""Vending X admin: stock overview, uploads, custom types and icons."""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.deps import AdminContext, require_admin
from app.db import get_db
from app.models.vendingx import VendingItem, VendingLog, VendingStock
from app.services.audit import audit

router = APIRouter(prefix="/admin/vendingx", tags=["admin-vendingx"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
_KEY_RE = re.compile(r"[^a-z0-9_]+")


def _norm_key(raw: str) -> str:
    key = _KEY_RE.sub("_", raw.strip().lower()).strip("_")[:80]
    if not key:
        raise HTTPException(400, "Type key must contain letters or numbers")
    return key


def _default_name(key: str) -> str:
    return key.removeprefix("premium_").replace("_", " ").title()


def _get_type(db: Session, key: str) -> VendingStock:
    t = db.scalar(select(VendingStock).where(VendingStock.key == key))
    if not t:
        raise HTTPException(404, "Stock type not found")
    return t


@router.get("")
def overview(db: Session = Depends(get_db), ctx: AdminContext = Depends(require_admin)):
    types = db.scalars(select(VendingStock).order_by(VendingStock.sort_order, VendingStock.key)).all()
    counts = dict(
        db.execute(
            select(VendingItem.stock_key, func.count())
            .where(VendingItem.dispensed.is_(False))
            .group_by(VendingItem.stock_key)
        ).all()
    )
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    recent = db.scalars(select(VendingLog).order_by(VendingLog.created_at.desc()).limit(25)).all()
    top = db.execute(
        select(VendingLog.user_id, func.max(VendingLog.username), func.count(), func.max(VendingLog.created_at))
        .group_by(VendingLog.user_id)
        .order_by(func.count().desc())
        .limit(10)
    ).all()

    return {
        "stats": {
            "total_stock": sum(counts.values()),
            "total_vends": db.scalar(select(func.count()).select_from(VendingLog)) or 0,
            "vends_today": db.scalar(
                select(func.count()).select_from(VendingLog).where(VendingLog.created_at >= start_of_day)
            ) or 0,
            "users": db.scalar(select(func.count(func.distinct(VendingLog.user_id)))) or 0,
        },
        "types": [
            {
                "key": t.key,
                "name": t.name,
                "description": t.description,
                "is_premium": t.is_premium,
                "icon_url": t.icon_url,
                "sort_order": t.sort_order,
                "count": counts.get(t.key, 0),
            }
            for t in types
        ],
        "recent": [
            {"username": r.username or r.user_id, "item": r.stock_name, "source": r.source, "time": r.created_at.isoformat()}
            for r in recent
        ],
        "top_users": [
            {"user_id": uid, "username": name or uid, "vends": n, "last": last.isoformat() if last else None}
            for uid, name, n, last in top
        ],
    }


@router.post("/upload")
async def upload(
    stock_key: str = Form(...),
    name: str = Form(""),
    is_premium: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    ctx: AdminContext = Depends(require_admin),
):
    if not (file.filename or "").lower().endswith(".txt"):
        raise HTTPException(400, "Upload a .txt file")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "File is larger than 5 MB")

    key = _norm_key(stock_key)
    stock_type = db.scalar(select(VendingStock).where(VendingStock.key == key))
    created = stock_type is None
    if created:
        stock_type = VendingStock(key=key, name=name.strip()[:120] or _default_name(key), is_premium=is_premium)
        db.add(stock_type)

    lines = [ln.strip() for ln in raw.decode("utf-8", errors="ignore").splitlines()]
    existing = set(db.scalars(select(VendingItem.content).where(VendingItem.stock_key == key)).all())
    fresh = list(dict.fromkeys(ln for ln in lines if ln and ln not in existing))
    db.add_all(VendingItem(stock_key=key, content=c, origin="admin") for c in fresh)

    audit(db, ctx.username, "vendingx.upload", "vendingx_type", key,
          {"added": len(fresh), "created": created}, ctx.ip)
    db.commit()

    nonblank = sum(1 for ln in lines if ln)
    return {
        "key": key,
        "created": created,
        "added": len(fresh),
        "skipped": nonblank - len(fresh),
        "total": db.scalar(
            select(func.count()).select_from(VendingItem)
            .where(VendingItem.stock_key == key, VendingItem.dispensed.is_(False))
        ) or 0,
    }


class TypePatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=300)
    is_premium: bool | None = None
    icon_url: str | None = Field(None, max_length=1000)
    sort_order: int | None = None


@router.patch("/types/{key}")
def update_type(key: str, body: TypePatch, db: Session = Depends(get_db), ctx: AdminContext = Depends(require_admin)):
    t = _get_type(db, key)
    data = body.model_dump(exclude_unset=True)
    if "icon_url" in data:
        icon = (data["icon_url"] or "").strip()
        if icon and not icon.startswith(("https://", "http://", "/")):
            raise HTTPException(400, "Icon must be an http(s) URL")
        data["icon_url"] = icon or None
    for field, value in data.items():
        setattr(t, field, value.strip() if isinstance(value, str) else value)
    audit(db, ctx.username, "vendingx.type_update", "vendingx_type", key, data, ctx.ip)
    db.commit()
    return {"ok": True}


@router.post("/types/{key}/clear")
def clear_type(key: str, db: Session = Depends(get_db), ctx: AdminContext = Depends(require_admin)):
    _get_type(db, key)
    n = db.execute(
        delete(VendingItem).where(VendingItem.stock_key == key, VendingItem.dispensed.is_(False))
    ).rowcount
    audit(db, ctx.username, "vendingx.clear", "vendingx_type", key, {"removed": n}, ctx.ip)
    db.commit()
    return {"removed": n}


@router.delete("/types/{key}")
def delete_type(key: str, db: Session = Depends(get_db), ctx: AdminContext = Depends(require_admin)):
    t = _get_type(db, key)
    db.execute(delete(VendingItem).where(VendingItem.stock_key == key, VendingItem.dispensed.is_(False)))
    db.delete(t)
    audit(db, ctx.username, "vendingx.delete_type", "vendingx_type", key, None, ctx.ip)
    db.commit()
    return {"ok": True}
