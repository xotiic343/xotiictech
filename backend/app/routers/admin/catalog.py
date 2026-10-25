from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import AdminContext, require_admin
from app.db import get_db
from app.models import BlogPost, Bot, DocPage, Product, Testimonial
from app.routers.admin.crud import crud_router
from app.schemas import BlogIn, DocIn, ProductIn, TestimonialIn
from app.serializers import blog_out, doc_out, product_admin, testimonial_out
from app.services import storage
from app.services.audit import audit


def _product_hook(db: Session, obj: Product, data: ProductIn, is_new: bool) -> None:
    if obj.bot_id is not None and db.get(Bot, obj.bot_id) is None:
        raise HTTPException(400, "Linked bot does not exist")
    if obj.bot_id is not None or obj.category == "discord_bots":
        obj.is_bot = True
    if obj.deliverable_key and not obj.deliverable_filename:
        obj.deliverable_filename = Path(obj.deliverable_key).name


def _doc_hook(db: Session, obj: DocPage, data: DocIn, is_new: bool) -> None:
    if obj.product_id is not None and db.get(Product, obj.product_id) is None:
        raise HTTPException(400, "Linked product does not exist")
    if obj.bot_id is not None and db.get(Bot, obj.bot_id) is None:
        raise HTTPException(400, "Linked bot does not exist")


products = crud_router(
    path="products", model=Product, schema=ProductIn, serialize=product_admin, entity="product",
    order_by=(Product.sort_order, Product.created_at.desc()), slug_source="name", before_save=_product_hook,
)
blog = crud_router(
    path="blog", model=BlogPost, schema=BlogIn, serialize=lambda p: blog_out(p, full=True), entity="blog_post",
    order_by=(BlogPost.created_at.desc(),), slug_source="title",
)
docs = crud_router(
    path="docs", model=DocPage, schema=DocIn, serialize=lambda d: doc_out(d, full=True), entity="doc",
    order_by=(DocPage.section, DocPage.sort_order), slug_source="title", before_save=_doc_hook,
)
testimonials = crud_router(
    path="testimonials", model=Testimonial, schema=TestimonialIn, serialize=testimonial_out, entity="testimonial",
    order_by=(Testimonial.sort_order, Testimonial.id),
)

# ---------------- uploads ----------------

uploads = APIRouter(prefix="/admin", tags=["admin-uploads"])

_SIGNATURES: dict[str, list[tuple[int, bytes]]] = {
    "image/png": [(0, b"\x89PNG\r\n\x1a\n")],
    "image/jpeg": [(0, b"\xff\xd8\xff")],
    "image/gif": [(0, b"GIF87a"), (0, b"GIF89a")],
    "image/webp": [(8, b"WEBP")],
    "video/mp4": [(4, b"ftyp")],
    "video/webm": [(0, b"\x1a\x45\xdf\xa3")],
}


def _sniff_ok(head: bytes, content_type: str) -> bool:
    return any(head[off:off + len(sig)] == sig for off, sig in _SIGNATURES.get(content_type, []))


def _size(upload: UploadFile) -> int:
    f = upload.file
    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    return size


@uploads.post("/uploads", status_code=201)
def upload(
    kind: Literal["media", "deliverable"] = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: AdminContext = Depends(require_admin),
):
    filename = Path(file.filename or "upload").name
    ext = Path(filename).suffix.lower()
    size = _size(file)
    if size == 0:
        raise HTTPException(400, "Empty file")

    if kind == "media":
        ctype = (file.content_type or "").lower()
        if ctype not in storage.MEDIA_TYPES:
            raise HTTPException(415, "Media must be PNG, JPEG, WebP, GIF, MP4 or WebM")
        if size > storage.MEDIA_MAX_BYTES:
            raise HTTPException(413, "Media files are limited to 50 MB")
        head = file.file.read(16)
        file.file.seek(0)
        if not _sniff_ok(head, ctype):
            raise HTTPException(415, "File contents don't match its type")
        key = storage.new_key("media", storage.MEDIA_TYPES[ctype])
        url = storage.put_public(file.file, key, ctype)
        audit(db, admin.username, "upload.media", "upload", key, {"filename": filename, "size": size}, ip=admin.ip)
        db.commit()
        return {"url": url, "type": "video" if ctype.startswith("video/") else "image", "key": key}

    if ext not in storage.DELIVERABLE_EXTENSIONS:
        raise HTTPException(415, f"Deliverables must be one of: {', '.join(sorted(storage.DELIVERABLE_EXTENSIONS))}")
    if size > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Deliverables are limited to {settings.max_upload_mb} MB")
    key = storage.new_key("deliverables", ext)
    storage.put_private(file.file, key, storage.guess_type(filename))
    audit(db, admin.username, "upload.deliverable", "upload", key, {"filename": filename, "size": size}, ip=admin.ip)
    db.commit()
    return {"key": key, "filename": filename, "size": size}
