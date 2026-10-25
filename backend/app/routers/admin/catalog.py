import math
from datetime import timedelta
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import AdminContext, require_admin
from app.core.security import create_token, decode_token
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
#
# Production (s3 backend): large-file flow. The browser uploads straight to the bucket in parts:
#   POST /admin/uploads/start     validate type + size, open a multipart upload, return a signed upload token
#   POST /admin/uploads/sign      presigned PUT URLs for a batch of part numbers
#   POST /admin/uploads/complete  assemble the parts, verify size (and media magic bytes), return url/key
#   POST /admin/uploads/abort     cancel and clean up
# The token is a short-lived JWT holding the key/upload id, so no server-side upload state is needed.
#
# Development (local backend): POST /admin/uploads, the original single-request upload.

uploads = APIRouter(prefix="/admin", tags=["admin-uploads"])

_SIGNATURES: dict[str, list[tuple[int, bytes]]] = {
    "image/png": [(0, b"\x89PNG\r\n\x1a\n")],
    "image/jpeg": [(0, b"\xff\xd8\xff")],
    "image/gif": [(0, b"GIF87a"), (0, b"GIF89a")],
    "image/webp": [(8, b"WEBP")],
    "video/mp4": [(4, b"ftyp")],
    "video/webm": [(0, b"\x1a\x45\xdf\xa3")],
    "video/quicktime": [(4, b"ftyp"), (4, b"moov"), (4, b"wide"), (4, b"mdat"), (4, b"free")],
}

UPLOAD_TOKEN = "upload"
MIN_PART = 16 * 1024 * 1024  # 16 MB parts (S3 minimum is 5 MB)
MAX_PARTS = 10_000  # S3 hard limit


def _sniff_ok(head: bytes, content_type: str) -> bool:
    return any(head[off:off + len(sig)] == sig for off, sig in _SIGNATURES.get(content_type, []))


def _check(kind: str, filename: str, content_type: str, size: int) -> tuple[str, str]:
    """Validate an upload and return (storage key, content type to store)."""
    if size <= 0:
        raise HTTPException(400, "Empty file")
    if kind == "media":
        ctype = content_type.lower()
        if ctype not in storage.MEDIA_TYPES:
            raise HTTPException(415, "Media must be PNG, JPEG, WebP, GIF, MP4, WebM or MOV")
        if size > storage.media_max_bytes():
            raise HTTPException(413, f"Media files are limited to {settings.max_media_mb} MB")
        return storage.new_key("media", storage.MEDIA_TYPES[ctype]), ctype
    ext = Path(filename).suffix.lower()
    if ext not in storage.DELIVERABLE_EXTENSIONS:
        raise HTTPException(415, f"Deliverables must be one of: {', '.join(sorted(storage.DELIVERABLE_EXTENSIONS))}")
    if size > storage.deliverable_max_bytes():
        raise HTTPException(413, f"Deliverables are limited to {settings.max_upload_mb} MB")
    return storage.new_key("deliverables", ext), storage.guess_type(filename)


def _result(kind: str, key: str, ctype: str, filename: str, size: int, url: str | None = None) -> dict:
    if kind == "media":
        return {"url": url or storage.public_url(key), "type": "video" if ctype.startswith("video/") else "image", "key": key}
    return {"key": key, "filename": filename, "size": size}


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
    """Single-request upload. Used by the local (development) backend; production uses /uploads/start."""
    filename = Path(file.filename or "upload").name
    size = _size(file)
    key, ctype = _check(kind, filename, file.content_type or "", size)

    if kind == "media":
        head = file.file.read(16)
        file.file.seek(0)
        if not _sniff_ok(head, ctype):
            raise HTTPException(415, "File contents don't match its type")
        url = storage.put_public(file.file, key, ctype)
    else:
        url = None
        storage.put_private(file.file, key, ctype)

    audit(db, admin.username, f"upload.{kind}", "upload", key, {"filename": filename, "size": size}, ip=admin.ip)
    db.commit()
    return _result(kind, key, ctype, filename, size, url)


class UploadStartIn(BaseModel):
    kind: Literal["media", "deliverable"]
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="", max_length=120)
    size: int = Field(gt=0)


class UploadTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=4000)


class UploadSignIn(UploadTokenIn):
    part_numbers: list[int] = Field(min_length=1, max_length=100)


def _upload_claims(token: str, admin: AdminContext) -> dict:
    claims = decode_token(token, UPLOAD_TOKEN)
    if not claims or claims.get("sub") != admin.username:
        raise HTTPException(400, "Upload session expired. Start the upload again.")
    return claims


@uploads.post("/uploads/start")
def upload_start(body: UploadStartIn, admin: AdminContext = Depends(require_admin)):
    filename = Path(body.filename).name
    key, ctype = _check(body.kind, filename, body.content_type, body.size)
    if settings.storage_backend != "s3":
        return {"mode": "simple"}  # local dev: the browser falls back to POST /admin/uploads

    part_size = max(MIN_PART, math.ceil(body.size / MAX_PARTS / (1024 * 1024)) * 1024 * 1024)
    parts = math.ceil(body.size / part_size)
    upload_id = storage.multipart_start(body.kind, key, ctype)
    token = create_token(
        admin.username,
        UPLOAD_TOKEN,
        timedelta(hours=24),
        {"key": key, "uid": upload_id, "kind": body.kind, "fn": filename, "ct": ctype, "size": body.size, "parts": parts},
    )
    return {"mode": "multipart", "token": token, "part_size": part_size, "parts": parts}


@uploads.post("/uploads/sign")
def upload_sign(body: UploadSignIn, admin: AdminContext = Depends(require_admin)):
    c = _upload_claims(body.token, admin)
    if any(n < 1 or n > c["parts"] for n in body.part_numbers):
        raise HTTPException(400, "Invalid part number")
    urls = storage.multipart_sign_parts(c["kind"], c["key"], c["uid"], body.part_numbers)
    return {"urls": {str(n): u for n, u in urls.items()}}


@uploads.post("/uploads/complete", status_code=201)
def upload_complete(body: UploadTokenIn, db: Session = Depends(get_db), admin: AdminContext = Depends(require_admin)):
    c = _upload_claims(body.token, admin)
    kind, key = c["kind"], c["key"]
    try:
        received = storage.multipart_complete(kind, key, c["uid"])
    except Exception as exc:
        storage.multipart_abort(kind, key, c["uid"])
        raise HTTPException(400, f"The storage provider could not assemble the file: {exc}") from exc

    if received != c["parts"] or storage.object_size(kind, key) != c["size"]:
        storage.delete_object(kind, key)
        raise HTTPException(400, "Upload incomplete: some parts are missing. Please try again.")
    if kind == "media" and not _sniff_ok(storage.object_head_bytes(kind, key), c["ct"]):
        storage.delete_object(kind, key)
        raise HTTPException(415, "File contents don't match its type")

    audit(db, admin.username, f"upload.{kind}", "upload", key, {"filename": c["fn"], "size": c["size"], "parts": received}, ip=admin.ip)
    db.commit()
    return _result(kind, key, c["ct"], c["fn"], c["size"])


@uploads.post("/uploads/abort", status_code=204)
def upload_abort(body: UploadTokenIn, admin: AdminContext = Depends(require_admin)):
    c = _upload_claims(body.token, admin)
    storage.multipart_abort(c["kind"], c["key"], c["uid"])
