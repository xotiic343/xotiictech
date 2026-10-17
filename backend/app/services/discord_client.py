"""Minimal, rate-limit-aware Discord REST client for a single bot token.

The token is only ever placed in the Authorization header. It is never logged, returned,
or included in exception messages.
"""

import logging
import time
from typing import Any

import httpx

from app.config import settings

log = logging.getLogger(__name__)

USER_AGENT = "DiscordBot (https://xotiictech.com, 1.0) XotiicTechSync"


class DiscordError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class DiscordAuthError(DiscordError):
    """Token is invalid / revoked — needs rotation."""


class DiscordClient:
    def __init__(self, token: str, timeout: float = 15.0):
        self._client = httpx.Client(
            base_url=settings.discord_api_base,
            headers={"Authorization": f"Bot {token}", "User-Agent": USER_AGENT},
            timeout=timeout,
        )

    def __enter__(self) -> "DiscordClient":
        return self

    def __exit__(self, *exc) -> None:
        self._client.close()

    def get(self, path: str, params: dict[str, Any] | None = None, max_retries: int = 3) -> Any:
        for attempt in range(max_retries + 1):
            try:
                r = self._client.get(path, params=params)
            except httpx.HTTPError as exc:
                if attempt >= max_retries:
                    raise DiscordError(f"network error on {path}: {type(exc).__name__}") from None
                time.sleep(1 + attempt)
                continue

            if r.status_code == 429:
                retry_after = _retry_after(r)
                log.warning("Discord rate limited on %s, sleeping %.2fs", path, retry_after)
                if attempt >= max_retries:
                    raise DiscordError(f"rate limited on {path}", 429)
                time.sleep(min(retry_after, 30))
                continue
            if r.status_code == 401:
                raise DiscordAuthError("401 Unauthorized — token invalid or revoked", 401)
            if r.status_code == 403:
                raise DiscordError(f"403 Forbidden on {path}", 403)
            if r.status_code >= 500:
                if attempt >= max_retries:
                    raise DiscordError(f"Discord {r.status_code} on {path}", r.status_code)
                time.sleep(1 + attempt)
                continue
            if r.status_code >= 400:
                raise DiscordError(f"Discord {r.status_code} on {path}", r.status_code)

            # Be polite: if the bucket is nearly empty, wait for it to reset.
            remaining = r.headers.get("x-ratelimit-remaining")
            if remaining is not None and remaining == "0":
                time.sleep(min(float(r.headers.get("x-ratelimit-reset-after", "1")), 10))
            return r.json()
        raise DiscordError(f"exhausted retries on {path}")

    # ---- endpoints ----
    def me(self) -> dict:
        return self.get("/users/@me")

    def application(self) -> dict:
        try:
            return self.get("/applications/@me")
        except DiscordAuthError:
            raise
        except DiscordError:
            return self.get("/oauth2/applications/@me")

    def guilds(self, max_pages: int = 50) -> list[dict]:
        out: list[dict] = []
        after: str | None = None
        for _ in range(max_pages):
            params: dict[str, Any] = {"limit": 200}
            if after:
                params["after"] = after
            page = self.get("/users/@me/guilds", params=params)
            out.extend(page)
            if len(page) < 200:
                break
            after = page[-1]["id"]
        return out

    def global_commands(self, application_id: str) -> list[dict]:
        return self.get(f"/applications/{application_id}/commands")

    def guild_commands(self, application_id: str, guild_id: str) -> list[dict]:
        return self.get(f"/applications/{application_id}/guilds/{guild_id}/commands")


def _retry_after(r: httpx.Response) -> float:
    try:
        return float(r.json().get("retry_after", 1))
    except Exception:
        return float(r.headers.get("retry-after", "1"))
