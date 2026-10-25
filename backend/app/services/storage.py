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
    "video/quicktime": ".mov",
}

DELIVERABLE_EXTENSIONS = {
    ".zip", ".7z", ".rar", ".tar", ".gz", ".tgz", ".xz", ".bz2",
    ".jar", ".exe", ".msi", ".dll", ".apk", ".dmg", ".iso",
    ".mcpack", ".mcaddon", ".mrpack", ".unitypackage",
    ".pdf", ".txt",
}

PUBLIC_CACHE = "public, max-age=31536000, immutable"


def media_max_bytes() -> int:
    return settings.max_media_mb * 1024 * 1024


def deliverable_max_bytes() -> int:
    return settings.max_upload_mb * 1024 * 1024


def _s3():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        # Path-style addressing works with Supabase Storage, Cloudflare R2 and Backblaze B2 alike.
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
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
            ExtraArgs={"ContentType": content_type, "CacheControl": PUBLIC_CACHE},
        )
        return public_url(key)
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


def public_url(key: str) -> str:
    return f"{settings.s3_public_base_url.rstrip('/')}/{key}"


# ---------------- direct-to-bucket multipart uploads (large files) ----------------
# The browser uploads parts straight to the bucket with presigned URLs, so big videos and zips never pass
# through the website or the API. Only used with the s3 backend; the local backend keeps simple uploads.


def bucket_for(kind: str) -> str:
    return settings.s3_public_bucket if kind == "media" else settings.s3_private_bucket


def multipart_start(kind: str, key: str, content_type: str) -> str:
    extra = {"ContentType": content_type}
    if kind == "media":
        extra["CacheControl"] = PUBLIC_CACHE
    res = _s3().create_multipart_upload(Bucket=bucket_for(kind), Key=key, **extra)
    return res["UploadId"]


def multipart_sign_parts(kind: str, key: str, upload_id: str, part_numbers: list[int], expires_seconds: int = 6 * 3600) -> dict[int, str]:
    client = _s3()
    return {
        n: client.generate_presigned_url(
            "upload_part",
            Params={"Bucket": bucket_for(kind), "Key": key, "UploadId": upload_id, "PartNumber": n},
            ExpiresIn=expires_seconds,
        )
        for n in part_numbers
    }


def multipart_complete(kind: str, key: str, upload_id: str) -> int:
    """Finish the upload from the parts the bucket actually received. Returns how many parts there were.
    ETags come from list_parts, so the browser never needs to read response headers (simpler bucket CORS)."""
    client = _s3()
    bucket = bucket_for(kind)
    parts: list[dict] = []
    marker = 0
    while True:
        res = client.list_parts(Bucket=bucket, Key=key, UploadId=upload_id, PartNumberMarker=marker, MaxParts=1000)
        parts += [{"PartNumber": p["PartNumber"], "ETag": p["ETag"]} for p in res.get("Parts", [])]
        if not res.get("IsTruncated"):
            break
        marker = res["NextPartNumberMarker"]
    parts.sort(key=lambda p: p["PartNumber"])
    client.complete_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id, MultipartUpload={"Parts": parts})
    return len(parts)


def multipart_abort(kind: str, key: str, upload_id: str) -> None:
    try:
        _s3().abort_multipart_upload(Bucket=bucket_for(kind), Key=key, UploadId=upload_id)
    except Exception as exc:  # aborting is best-effort cleanup
        log.warning("abort_multipart_upload failed for %s: %s", key, exc)


def object_size(kind: str, key: str) -> int:
    return int(_s3().head_object(Bucket=bucket_for(kind), Key=key)["ContentLength"])


def object_head_bytes(kind: str, key: str, n: int = 16) -> bytes:
    res = _s3().get_object(Bucket=bucket_for(kind), Key=key, Range=f"bytes=0-{n - 1}")
    return res["Body"].read()


def delete_object(kind: str, key: str) -> None:
    try:
        _s3().delete_object(Bucket=bucket_for(kind), Key=key)
    except Exception as exc:
        log.warning("delete_object failed for %s: %s", key, exc)
