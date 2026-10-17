from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- core ---
    environment: str = "development"  # development | production
    secret_key: str = "dev-insecure-change-me"
    database_url: str = "sqlite:///./dev.db"
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = ""  # extra comma-separated origins; frontend_url is always allowed
    proxy_shared_secret: str = ""  # shared with the Next.js /api proxy so it can relay the client IP
    trusted_proxy_hops: int = 0  # fallback: proxies appending to X-Forwarded-For for direct callers

    # --- cookies / sessions ---
    cookie_secure: bool = False
    cookie_domain: str | None = None
    user_session_days: int = 14
    admin_session_hours: int = 8

    # --- admin ---
    admin_username: str = "admin"
    admin_password_hash: str = ""
    admin_totp_secret: str = ""
    admin_ip_allowlist: str = ""  # comma-separated IPs; empty = allow all

    # --- stripe ---
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    currency: str = "usd"

    # --- storage (Cloudflare R2 / any S3-compatible) ---
    storage_backend: str = "local"  # local | s3
    s3_endpoint_url: str = ""  # https://<account_id>.r2.cloudflarestorage.com
    s3_region: str = "auto"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_bucket: str = ""
    s3_private_bucket: str = ""
    s3_public_base_url: str = ""  # https://media.xotiictech.com
    local_storage_dir: str = "./storage"
    max_upload_mb: int = 200

    # --- email (Resend) ---
    resend_api_key: str = ""
    email_from: str = "XotiicTech <noreply@xotiictech.com>"
    admin_notify_email: str = ""

    # --- discord ---
    discord_bot_tokens: str = ""
    discord_api_base: str = "https://discord.com/api/v10"
    discord_sync_guild_commands: bool = False

    # --- scheduler ---
    enable_scheduler: bool = True
    sync_on_startup: bool = True

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Render hands out postgres:// URLs; SQLAlchemy + psycopg3 wants postgresql+psycopg://
        if v.startswith("postgres://"):
            v = "postgresql+psycopg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def discord_tokens(self) -> list[str]:
        return [t.strip() for t in self.discord_bot_tokens.split(",") if t.strip()]

    @property
    def allowed_origins(self) -> list[str]:
        extra = [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]
        return list(dict.fromkeys([self.frontend_url.rstrip("/"), *extra]))

    @property
    def admin_ips(self) -> set[str]:
        return {ip.strip() for ip in self.admin_ip_allowlist.split(",") if ip.strip()}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production:
        if s.secret_key == "dev-insecure-change-me" or len(s.secret_key) < 32:
            raise RuntimeError("SECRET_KEY must be set to a random value of at least 32 chars in production")
        if not s.cookie_secure:
            raise RuntimeError("COOKIE_SECURE must be true in production")
    return s


settings = get_settings()
