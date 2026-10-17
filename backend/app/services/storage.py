"""File storage: public media (images/videos) and private deliverables.

`s3` backend works with Cloudflare R2, Backblaze B2 or AWS S3. `local` is for development only.
"""

import logging
import mimetypes
import uuid
from pathlib import Path
from typing import BinaryIO

from app.config import settings

log = logging.getLogger(__name__)

MEDIA_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
}
MEDIA_MAX_BYTES = 50 * 1024 * 1024

DELIVERABLE_EXTENSIONS = {".zip", ".7z", ".rar", ".jar", ".exe", ".msi", ".tar", ".gz", ".pdf", ".txt"}


def _s3():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(signature_version="s3v4"),
    )


def _local_path(bucket: str, key: str) -> Path:
    root = Path(settings.local_storage_dir).resolve()
    path = (root / bucket / key).resolve()
    if root not in path.parents:
        raise ValueError("invalid key")
    return path


def new_key(prefix: str, ext: str) -> str:
    return f"{prefix}/{uuid.uuid4().hex}{ext}"


def put_public(fileobj: BinaryIO, key: str, content_type: str) -> str:
    """Store a public media file and return its URL."""
    if settings.storage_backend == "s3":
        _s3().upload_fileobj(
            fileobj,
            settings.s3_public_bucket,
            key,
            ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000, immutable"},
        )
        return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
    path = _local_path("public", key)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        f.write(fileobj.read())
    # Served by the API but addressed through the site's same-origin /api proxy.
    return f"{settings.frontend_url.rstrip('/')}/api/media/{key}"


def put_private(fileobj: BinaryIO, key: str, content_type: str) -> None:
    if settings.storage_backend == "s3":
        _s3().upload_fileobj(fileobj, settings.s3_private_bucket, key, ExtraArgs={"ContentType": content_type})
        return
    path = _local_path("private", key)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        f.write(fileobj.read())


def private_download_url(key: str, filename: str, expires_seconds: int = 300) -> str | None:
    """Short-lived presigned URL for a private object. Local backend returns None (served directly)."""
    if settings.storage_backend != "s3":
        return None
    return _s3().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_private_bucket,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=expires_seconds,
    )


def local_private_path(key: str) -> Path:
    return _local_path("private", key)


def local_public_path(key: str) -> Path:
    return _local_path("public", key)


def guess_type(filename: str) -> str:
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"
