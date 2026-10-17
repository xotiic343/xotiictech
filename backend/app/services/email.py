"""Transactional email via Resend's HTTP API. Without an API key, emails are logged (dev)."""

import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)


def send_email(to: str, subject: str, text: str, reply_to: str | None = None) -> bool:
    if not settings.resend_api_key:
        log.info("[email:dev] to=%s subject=%s\n%s", to, subject, text)
        return True
    payload = {"from": settings.email_from, "to": [to], "subject": subject, "text": text}
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=15,
        )
        if r.status_code >= 400:
            log.error("Resend error %s: %s", r.status_code, r.text[:300])
            return False
        return True
    except httpx.HTTPError as exc:
        log.error("Resend request failed: %s", exc)
        return False


def notify_admin(subject: str, text: str, reply_to: str | None = None) -> None:
    if settings.admin_notify_email:
        send_email(settings.admin_notify_email, subject, text, reply_to=reply_to)
