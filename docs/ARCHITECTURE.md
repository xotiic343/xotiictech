# XotiicTech — Architecture

## Folder structure

```
xotiictechweb/
├── render.yaml                  # Render blueprint: API + web + Postgres
├── README.md
├── docs/
│   ├── ARCHITECTURE.md          # this file
│   ├── STRIPE_SETUP.md
│   ├── STORAGE_SETUP.md         # Cloudflare R2 / Backblaze B2
│   └── DISCORD_SYNC.md
├── backend/                     # FastAPI
│   ├── alembic.ini
│   ├── alembic/                 # migrations (env.py, versions/)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       ├── main.py              # app factory, middleware, lifespan (scheduler)
│       ├── config.py            # pydantic-settings, all env vars
│       ├── db.py                # engine / session
│       ├── models/              # SQLAlchemy 2.0 models
│       ├── schemas/             # Pydantic request/response models
│       ├── core/                # security (JWT, bcrypt, TOTP, CSRF), deps, rate limit, middleware, log redaction
│       ├── services/            # discord sync, stripe, storage (R2), email (Resend), audit, settings store, scheduler
│       ├── routers/
│       │   ├── public/          # site, bots, store, content, checkout, webhooks, downloads, auth, account
│       │   └── admin/           # everything under /api/admin (2FA, CSRF, IP allowlist)
│       └── scripts/             # create_admin (hash + TOTP secret), seed
└── frontend/                    # Next.js 15 App Router + Tailwind + Framer Motion
    ├── next.config.mjs          # /api/* proxied to FastAPI → same-origin cookies
    ├── src/middleware.ts        # guards /xotiic/* and /account
    └── src/
        ├── app/                 # routes (public, /account, /xotiic admin)
        ├── components/          # fx (boot, matrix, glitch, terminal), cards, forms, admin kit
        └── lib/                 # api clients, types, zod schemas
```

**Why a proxy?** The browser only ever talks to `xotiictech.com`. Next.js rewrites `/api/*` to the
FastAPI service, so auth cookies are first-party, `SameSite=Strict/Lax` works, and CORS stays locked.

## FastAPI route map (all under `/api`)

### Public
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/site` | hero, ticker, stats, socials, footer, testimonials |
| GET | `/status` | API + per-bot status for `/status` |
| GET | `/bots` | published bots (`?tag=&sort=servers\|name\|newest`) |
| GET | `/bots/stats` | total bots / servers / commands |
| GET | `/bots/{slug}` | bot detail + commands + linked product + reviews |
| POST | `/bots/inquiries` | commission form (rate-limited) |
| POST | `/bots/{slug}/reviews` | buyers only |
| GET | `/products`, `/products/{slug}` | store (`?category=&q=&sort=`) |
| GET | `/portfolio`, `/portfolio/{slug}` | |
| GET | `/blog`, `/blog/{slug}` | `?kind=changelog` powers `/changelog` |
| GET | `/docs`, `/docs/{slug}` | docs + FAQ |
| POST | `/contact`, `/newsletter` | rate-limited |
| POST | `/checkout/session` | creates Stripe Checkout session (rate-limited) |
| GET | `/checkout/session/{id}` | success page lookup |
| POST | `/webhooks/stripe` | signature-verified |
| GET | `/downloads/{token}` | signed token → 302 to short-lived R2 presigned URL |
| POST | `/analytics/view` | page-view beacon |
| POST | `/auth/register`, `/auth/login`, `/auth/magic-link`, `/auth/magic-link/verify`, `/auth/logout` | buyers |
| GET | `/auth/me` | |
| GET | `/account/orders` | |
| POST | `/account/orders/{id}/download-link` | fresh link while not expired |
| POST | `/account/orders/{id}/hosting` | submit Discord server ID for hosted bots |

### Admin (`/api/admin`, admin JWT + TOTP + CSRF + optional IP allowlist)
| Method | Path |
|---|---|
| POST | `/auth/login` (username + password + TOTP), `/auth/logout`; GET `/auth/me` |
| GET | `/dashboard`, `/analytics` |
| CRUD | `/products`, `/portfolio`, `/blog`, `/docs`, `/testimonials` |
| POST | `/uploads` (media → public bucket, deliverable → private bucket) |
| GET | `/bots`, `/bots/inbox`, `/bots/tokens`, `/bots/sync-logs`, `/bots/{id}` |
| PATCH | `/bots/{id}` (overrides), `/bots/{id}/commands/{cmd_id}` |
| POST | `/bots/sync`, `/bots/{id}/publish`, `/bots/{id}/unpublish` |
| GET/PATCH/DELETE | `/inquiries`, `/inquiries/{id}` |
| GET/PATCH | `/orders`, `/orders/{id}`; POST `/orders/{id}/resend` |
| GET/PUT | `/content`, `/content/{key}`; `/settings` |
| GET | `/users`, `/newsletter`, `/messages`, `/audit-logs` |

## DB schema

| Table | Key columns |
|---|---|
| `users` | email (unique), password_hash?, name, is_active, last_login_at |
| `magic_link_tokens` | user_id, token_hash, expires_at, used_at |
| `products` | slug, name, tagline, description, features[], category, sell_type, price_cents, currency, media[], deliverable_key/filename, version, changelog, is_published, is_featured, is_bot, bot_id → bots, sales_count |
| `bots` | **synced:** discord_id (unique), application_id, username, avatar/banner hash, app_description, app_tags[], bot_public, guild_count, install_scopes/permissions, custom_install_url, status, last_synced_at, last_error · **overrides:** slug, display_name, short_description, long_description, tags[], category, pricing_type, price_label, media[], support_url, website_url, invite_permissions, version, changelog, is_featured, is_hidden, is_published, published_at |
| `bot_commands` | bot_id, discord_command_id, guild_id?, name, description, type, options[], is_hidden — unique(bot_id, discord_command_id) |
| `discord_tokens` | fingerprint (sha256, unique), masked_hint, env_position, bot_discord_id, status (healthy/invalid/error/removed), last_checked_at, last_error — **raw tokens are never stored** |
| `bot_sync_logs` | trigger, status, started_at, finished_at, bots_seen, bots_new, bots_failed, errors[] |
| `bot_inquiries` | discord_username, email, server_size, purpose, features, budget, timeline, status, admin_notes |
| `reviews` | bot_id/product_id, user_id, rating, body, is_approved |
| `orders` | public_id (uuid), user_id?, email, product_id, amount_cents, currency, status, stripe_session_id, stripe_payment_intent, download_expires_at, download_count, refund_notes, hosting_server_id, hosting_status, paid_at |
| `portfolio_projects` | slug, title, summary, body, category, stack[], cover_image, media[], live_url, repo_url, is_featured, is_published, sort_order |
| `blog_posts` | slug, title, excerpt, body, kind, tags[], cover_image, is_published, published_at |
| `doc_pages` | slug, title, section, body, product_id?, bot_id?, sort_order, is_published |
| `testimonials` | name, role, quote, avatar_url, rating, sort_order, is_published |
| `newsletter_subscribers` | email (unique), unsubscribed_at |
| `contact_messages` | name, email, subject, message, status |
| `site_settings` | key (pk), value (JSON) — content blocks (`content.*`) and settings (`settings.*`) |
| `page_views` | path, referrer, bot_id?, product_id?, created_at |
| `audit_logs` | actor, action, entity_type, entity_id, details, ip, created_at |
