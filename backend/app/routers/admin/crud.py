"""Generic admin CRUD router for simple content models (with audit logging)."""

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import AdminContext, require_admin
from app.db import get_db
from app.services.audit import audit
from app.services.slugs import unique_slug


def crud_router(
    *,
    path: str,
    model: Any,
    schema: type[BaseModel],
    serialize: Callable[[Any], dict],
    entity: str,
    order_by: tuple,
    slug_source: str | None = None,
    before_save: Callable[[Session, Any, BaseModel, bool], None] | None = None,
) -> APIRouter:
    router = APIRouter(prefix=f"/admin/{path}", tags=[f"admin-{path}"])

    def _get(db: Session, item_id: int):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(404, f"{entity} not found")
        return obj

    def _apply(db: Session, obj: Any, data: BaseModel, is_new: bool) -> None:
        values = data.model_dump()
        if slug_source:
            requested = values.pop("slug", None)
            if requested:
                taken = db.scalar(
                    select(model.id).where(model.slug == requested, model.id != (obj.id or -1))
                )
                if taken:
                    raise HTTPException(409, f"Slug '{requested}' is already used")
                obj.slug = requested
            elif is_new or not obj.slug:
                obj.slug = unique_slug(db, model, values[slug_source], exclude_id=obj.id)
        for k, v in values.items():
            if k == "media" and v is not None:
                v = [m if isinstance(m, dict) else m.model_dump() for m in v]
            setattr(obj, k, v)
        if hasattr(obj, "published_at") and getattr(obj, "is_published", False) and not obj.published_at:
            obj.published_at = datetime.now(timezone.utc)
        if before_save:
            before_save(db, obj, data, is_new)

    @router.get("")
    def list_items(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
        return {"items": [serialize(o) for o in db.scalars(select(model).order_by(*order_by)).unique().all()]}

    @router.get("/{item_id}")
    def get_item(item_id: int, db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
        return serialize(_get(db, item_id))

    @router.post("", status_code=201)
    def create_item(
        data: schema = Body(...),  # type: ignore[valid-type]
        db: Session = Depends(get_db),
        admin: AdminContext = Depends(require_admin),
    ):
        obj = model()
        _apply(db, obj, data, True)
        db.add(obj)
        db.flush()
        audit(db, admin.username, f"{path}.create", entity, obj.id, ip=admin.ip)
        db.commit()
        return serialize(obj)

    @router.put("/{item_id}")
    def update_item(
        item_id: int,
        data: schema = Body(...),  # type: ignore[valid-type]
        db: Session = Depends(get_db),
        admin: AdminContext = Depends(require_admin),
    ):
        obj = _get(db, item_id)
        _apply(db, obj, data, False)
        audit(db, admin.username, f"{path}.update", entity, obj.id, ip=admin.ip)
        db.commit()
        return serialize(obj)

    @router.delete("/{item_id}")
    def delete_item(item_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
        obj = _get(db, item_id)
        db.delete(obj)
        audit(db, admin.username, f"{path}.delete", entity, item_id, ip=admin.ip)
        db.commit()
        return {"ok": True}

    return router
