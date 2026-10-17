import logging

from app.config import settings


class SecretRedactionFilter(logging.Filter):
    """Scrubs configured secrets (Discord tokens, API keys) from every log record."""

    def __init__(self, secrets: list[str]):
        super().__init__()
        self._secrets = [s for s in secrets if s and len(s) >= 8]

    def filter(self, record: logging.LogRecord) -> bool:
        if not self._secrets:
            return True
        msg = record.getMessage()
        redacted = msg
        for s in self._secrets:
            if s in redacted:
                redacted = redacted.replace(s, "[REDACTED]")
        if redacted != msg:
            record.msg = redacted
            record.args = ()
        return True


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    secrets = [
        *settings.discord_tokens,
        settings.stripe_secret_key,
        settings.stripe_webhook_secret,
        settings.resend_api_key,
        settings.s3_secret_access_key,
        settings.secret_key,
    ]
    flt = SecretRedactionFilter(secrets)
    for handler in logging.getLogger().handlers:
        handler.addFilter(flt)
    # httpx logs full request lines at INFO; keep it quiet.
    logging.getLogger("httpx").setLevel(logging.WARNING)
