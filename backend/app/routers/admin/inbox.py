"""Commission inquiries, contact messages, orders."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import AdminContext, require_admin
from app.db import get_db
from app.models import BotInquiry, ContactMessage, Order
from app.schemas import InquiryPatch, MessagePatch, OrderPatch
from app.serializers import columns, order_admin
from app.services import orders as order_service
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin-inbox"])


# ---------------- commission inquiries ----------------


@router.get("/inquiries")
def list_inquiries(
    db: Session = Depends(get_db),
    _: AdminContext = Depends(require_admin),
    status: Literal["new", "replied", "closed"] | None = None,
):
    stmt = select(BotInquiry).order_by(BotInquiry.created_at.desc())
    if status:
        stmt = stmt.where(BotInquiry.status == status)
    counts = dict(db.execute(select(BotInquiry.status, func.count()).group_by(BotInquiry.status)).all())
    return {"items": [columns(i) for i in db.scalars(stmt).all()], "counts": counts}


@router.patch("/inquiries/{inquiry_id}")
def update_inquiry(
    inquiry_id: int, body: InquiryPatch, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)
):
    inq = db.get(BotInquiry, inquiry_id)
    if not inq:
        raise HTTPException(404, "Inquiry not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(inq, k, v)
    audit(db, admin.username, "inquiry.update", "bot_inquiry", inq.id, body.model_dump(exclude_unset=True, exclude={"admin_notes"}), ip=admin.ip)
    db.commit()
    return columns(inq)


@router.delete("/inquiries/{inquiry_id}")
def delete_inquiry(inquiry_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    inq = db.get(BotInquiry, inquiry_id)
    if not inq:
        raise HTTPException(404, "Inquiry not found")
    db.delete(inq)
    audit(db, admin.username, "inquiry.delete", "bot_inquiry", inquiry_id, ip=admin.ip)
    db.commit()
    return {"ok": True}


# ---------------- contact messages ----------------


@router.get("/messages")
def list_messages(db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    rows = db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(500)).all()
    return {"items": [columns(m) for m in rows]}


@router.patch("/messages/{message_id}")
def update_message(
    message_id: int, body: MessagePatch, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)
):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    msg.status = body.status
    audit(db, admin.username, "message.update", "contact_message", msg.id, {"status": body.status}, ip=admin.ip)
    db.commit()
    return columns(msg)


@router.delete("/messages/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    msg = db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    db.delete(msg)
    audit(db, admin.username, "message.delete", "contact_message", message_id, ip=admin.ip)
    db.commit()
    return {"ok": True}


# ---------------- orders ----------------


@router.get("/orders")
def list_orders(
    db: Session = Depends(get_db),
    _: AdminContext = Depends(require_admin),
    q: str | None = Query(None, max_length=200),
    status: Literal["pending", "paid", "refunded", "failed"] | None = None,
    hosting: Literal["requested", "approved", "deployed", "rejected"] | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    stmt = select(Order)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(Order.email.ilike(like), Order.product_name.ilike(like), Order.public_id.ilike(like),
                Order.stripe_session_id.ilike(like))
        )
    if status:
        stmt = stmt.where(Order.status == status)
    if hosting:
        stmt = stmt.where(Order.hosting_status == hosting)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)).unique().all()
    return {"items": [order_admin(o) for o in rows], "total": total}


@router.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), _: AdminContext = Depends(require_admin)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order_admin(order)


@router.patch("/orders/{order_id}")
def update_order(
    order_id: int, body: OrderPatch, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(order, k, v)
    audit(db, admin.username, "order.update", "order", order.id, {"fields": sorted(changes)}, ip=admin.ip)
    db.commit()
    return order_admin(order)


@router.post("/orders/{order_id}/resend")
def resend_order(order_id: int, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "paid":
        raise HTTPException(400, "Only paid orders can be resent")
    order_service.refresh_download_window(db, order)
    db.commit()
    ok = order_service.send_order_email(db, order)
    audit(db, admin.username, "order.resend", "order", order.id, {"email_ok": ok}, ip=admin.ip)
    db.commit()
    if not ok:
        raise HTTPException(502, "Email provider rejected the message — check RESEND_API_KEY")
    return {"ok": True, "download_expires_at": order.download_expires_at.isoformat()}
