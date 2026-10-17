"""Pydantic request models. Every write endpoint validates through one of these."""

from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

Str = Annotated[str, StringConstraints(strip_whitespace=True)]
ShortStr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Slug = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)]
DiscordId = Annotated[str, StringConstraints(pattern=r"^\d{15,22}$")]
Category = Literal["source_code", "discord_bots", "minecraft_clients", "pc_applications"]
SellType = Literal["download", "source_code", "license", "hosted", "custom_build"]


def _url_or_empty(v: Any) -> Any:
    if v in ("", None):
        return None
    parsed = urlparse(str(v))
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("must be an http(s) URL")
    return str(v)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MediaItem(Strict):
    type: Literal["image", "video"] = "image"
    url: Annotated[str, StringConstraints(max_length=500)]
    alt: Annotated[str, StringConstraints(max_length=200)] = ""

    @field_validator("url")
    @classmethod
    def _check_urls(cls, v: Any) -> Any:
        return _url_or_empty(v)


# ---------------- public forms ----------------


class CommissionIn(Strict):
    discord_username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    email: EmailStr
    server_size: Literal["<100", "100-1k", "1k-10k", "10k-100k", "100k+"]
    purpose: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=3000)]
    features: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)]
    budget: Literal["<$50", "$50-150", "$150-500", "$500-1500", "$1500+"]
    timeline: Literal["asap", "1-2 weeks", "1 month", "flexible"]
    reference_bot: Slug | None = None
    website: str = ""  # honeypot â€” must stay empty


class ContactIn(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    subject: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)]
    website: str = ""  # honeypot


class NewsletterIn(Strict):
    email: EmailStr
    source: Annotated[str, StringConstraints(max_length=60)] | None = None


class ReviewIn(Strict):
    rating: int = Field(ge=1, le=5)
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=2000)]


class CheckoutIn(Strict):
    product_slug: Slug
    email: EmailStr | None = None


class PageViewIn(Strict):
    path: Annotated[str, StringConstraints(max_length=300, pattern=r"^/")]
    referrer: Annotated[str, StringConstraints(max_length=500)] | None = None


class HostingRequestIn(Strict):
    server_id: DiscordId


# ---------------- auth ----------------


class PasswordSetIn(Strict):
    current_password: Annotated[str, StringConstraints(max_length=128)] | None = None
    new_password: Annotated[str, StringConstraints(min_length=10, max_length=128)]
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None


class LoginIn(Strict):
    email: EmailStr
    password: Annotated[str, StringConstraints(max_length=128)]


class MagicLinkIn(Strict):
    email: EmailStr


class MagicVerifyIn(Strict):
    token: Annotated[str, StringConstraints(min_length=20, max_length=200)]


class AdminLoginIn(Strict):
    username: Annotated[str, StringConstraints(max_length=100)]
    password: Annotated[str, StringConstraints(max_length=200)]
    totp: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]


# ---------------- admin: catalog ----------------


class ProductIn(Strict):
    slug: Slug | None = None
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    tagline: Annotated[str, StringConstraints(max_length=300)] | None = None
    description: Annotated[str, StringConstraints(max_length=50_000)] = ""
    features: list[Annotated[str, StringConstraints(max_length=200)]] = Field(default_factory=list, max_length=50)
    category: Category
    sell_type: SellType = "download"
    price_cents: int = Field(ge=0, le=10_000_000)
    currency: Annotated[str, StringConstraints(pattern=r"^[a-z]{3}$")] = "usd"
    media: list[MediaItem] = Field(default_factory=list, max_length=30)
    deliverable_key: Annotated[str, StringConstraints(max_length=500)] | None = None
    deliverable_filename: Annotated[str, StringConstraints(max_length=255)] | None = None
    version: Annotated[str, StringConstraints(max_length=40)] | None = None
    changelog: Annotated[str, StringConstraints(max_length=50_000)] | None = None
    is_published: bool = False
    is_featured: bool = False
    is_bot: bool = False
    bot_id: int | None = None
    sort_order: int = 0


class ProductPatch(ProductIn):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)] | None = None  # type: ignore[assignment]
    category: Category | None = None  # type: ignore[assignment]
    price_cents: int | None = Field(default=None, ge=0, le=10_000_000)  # type: ignore[assignment]


class BotPatch(Strict):
    slug: Slug | None = None
    display_name: Annotated[str, StringConstraints(max_length=100)] | None = None
    short_description: Annotated[str, StringConstraints(max_length=300)] | None = None
    long_description: Annotated[str, StringConstraints(max_length=50_000)] | None = None
    tags: list[Annotated[str, StringConstraints(max_length=40)]] | None = Field(default=None, max_length=20)
    category: Annotated[str, StringConstraints(max_length=60)] | None = None
    pricing_type: Literal["free", "premium", "custom"] | None = None
    price_label: Annotated[str, StringConstraints(max_length=60)] | None = None
    media: list[MediaItem] | None = Field(default=None, max_length=30)
    support_url: str | None = None
    website_url: str | None = None
    invite_permissions: Annotated[str, StringConstraints(pattern=r"^\d{0,20}$")] | None = None
    version: Annotated[str, StringConstraints(max_length=40)] | None = None
    changelog: Annotated[str, StringConstraints(max_length=50_000)] | None = None
    is_featured: bool | None = None
    is_hidden: bool | None = None
    sort_order: int | None = None

    @field_validator("support_url", "website_url")
    @classmethod
    def _check_urls(cls, v: Any) -> Any:
        return _url_or_empty(v)


class BotCommandPatch(Strict):
    is_hidden: bool


class InquiryPatch(Strict):
    status: Literal["new", "replied", "closed"] | None = None
    admin_notes: Annotated[str, StringConstraints(max_length=10_000)] | None = None


class MessagePatch(Strict):
    status: Literal["new", "replied", "closed"]


class OrderPatch(Strict):
    admin_notes: Annotated[str, StringConstraints(max_length=10_000)] | None = None
    refund_notes: Annotated[str, StringConstraints(max_length=10_000)] | None = None
    hosting_status: Literal["none", "requested", "approved", "deployed", "rejected"] | None = None
    status: Literal["pending", "paid", "refunded", "failed"] | None = None


class ReviewPatch(Strict):
    is_approved: bool


# ---------------- admin: content ----------------


class PortfolioIn(Strict):
    slug: Slug | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    summary: Annotated[str, StringConstraints(max_length=400)] = ""
    body: Annotated[str, StringConstraints(max_length=50_000)] = ""
    category: Annotated[str, StringConstraints(max_length=60)] | None = None
    stack: list[Annotated[str, StringConstraints(max_length=40)]] = Field(default_factory=list, max_length=30)
    cover_image: str | None = None
    media: list[MediaItem] = Field(default_factory=list, max_length=30)
    live_url: str | None = None
    repo_url: str | None = None
    is_featured: bool = False
    is_published: bool = False
    sort_order: int = 0

    @field_validator("cover_image", "live_url", "repo_url")
    @classmethod
    def _check_urls(cls, v: Any) -> Any:
        return _url_or_empty(v)


class BlogIn(Strict):
    slug: Slug | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    excerpt: Annotated[str, StringConstraints(max_length=400)] = ""
    body: Annotated[str, StringConstraints(max_length=100_000)] = ""
    kind: Literal["announcement", "tutorial", "changelog"] = "announcement"
    tags: list[Annotated[str, StringConstraints(max_length=40)]] = Field(default_factory=list, max_length=20)
    cover_image: str | None = None
    is_published: bool = False

    @field_validator("cover_image")
    @classmethod
    def _check_urls(cls, v: Any) -> Any:
        return _url_or_empty(v)


class DocIn(Strict):
    slug: Slug | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    section: Annotated[str, StringConstraints(max_length=60)] = "guides"
    body: Annotated[str, StringConstraints(max_length=100_000)] = ""
    product_id: int | None = None
    bot_id: int | None = None
    sort_order: int = 0
    is_published: bool = False


class TestimonialIn(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    role: Annotated[str, StringConstraints(max_length=160)] | None = None
    quote: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    avatar_url: str | None = None
    rating: int = Field(default=5, ge=1, le=5)
    sort_order: int = 0
    is_published: bool = True

    @field_validator("avatar_url")
    @classmethod
    def _check_urls(cls, v: Any) -> Any:
        return _url_or_empty(v)


class SettingsIn(Strict):
    download_expiry_hours: int | None = Field(default=None, ge=1, le=24 * 30)
    max_downloads_per_order: int | None = Field(default=None, ge=0, le=1000)
    discord_sync_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    auto_publish_new_bots: bool | None = None
    reviews_require_approval: bool | None = None
    email_order_subject: Annotated[str, StringConstraints(max_length=200)] | None = None
    email_order_body: Annotated[str, StringConstraints(max_length=10_000)] | None = None
    email_magic_link_subject: Annotated[str, StringConstraints(max_length=200)] | None = None


class ContentIn(BaseModel):
    value: Any
