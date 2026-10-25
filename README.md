# XotiicTech

Retro-terminal storefront and platform for XotiicTech. Discord bots are auto-imported straight from Discord, there's a store with instant Stripe delivery, a portfolio, blog, docs and buyer accounts, plus a 2FA-protected admin panel at `/xotiic`.

`/support` is the Xotiic Support ticket system: Discord login, tickets synced with the Ticket X bot, and a staff panel at `/support/exotic`. It runs in the Next.js frontend. See [docs/SUPPORT.md](docs/SUPPORT.md).

```
backend/   FastAPI · SQLAlchemy 2 · Alembic · APScheduler · Stripe · R2 (boto3) · Resend
frontend/  Next.js 15 (App Router) · Tailwind · Framer Motion · zod
render.yaml  one-click Render deploy (API + web + Postgres)
docs/      ARCHITECTURE · STRIPE_SETUP · STORAGE_SETUP · DISCORD_SYNC
```

## How it fits together

```
browser ──► xotiictech.com (Next.js) ──/api/* proxy──► FastAPI ──► Postgres
                     │                                   ├──► Discord API (bot sync, every ~45 min)
                     └─ server components fetch API      ├──► Stripe (checkout + webhooks)
                        over Render's private network    ├──► R2 (public media / private deliverables)
                                                         └──► Resend (emails)
```

The browser only ever talks to `xotiictech.com`. Next.js proxies `/api/*` to FastAPI, so auth cookies are first-party and the API doesn't need a public domain. Discord tokens, Stripe keys and storage credentials exist only in the API service's environment.

## Local development

**Requirements:** Python 3.11+ and Node 20+. Postgres is optional, since SQLite works for dev.

```bash
# --- backend ---
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m app.scripts.create_admin     # paste the 3 printed ADMIN_* values into .env
alembic upgrade head
python -m app.scripts.seed             # sample bot, product, post, portfolio item, docs, legal pages
uvicorn app.main:app --reload --port 8000

# --- frontend (new terminal) ---
cd frontend
cp .env.example .env.local
npm install
npm run dev                            # http://localhost:3000  ·  admin: /xotiic
```

API docs (dev only): http://localhost:8000/api/docs

Without Stripe, R2 or Resend keys the app still runs: checkout returns a clear "not configured" error, uploads go to `backend/storage/`, and emails are printed to the API log.

## Environment variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example). Each variable has an inline comment. The important ones:

| Variable | Service | Purpose |
|---|---|---|
| `SECRET_KEY` | api | signs sessions and download links (≥32 random chars) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_TOTP_SECRET` | api | admin login + required 2FA (`python -m app.scripts.create_admin`) |
| `ADMIN_IP_ALLOWLIST` | api | optional; non-listed IPs get a 404 on admin routes |
| `DISCORD_BOT_TOKENS` | api | comma-separated, one token per bot to auto-import |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | api | payments |
| `S3_*`, `STORAGE_BACKEND=s3` | api | Cloudflare R2 buckets |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL` | api | transactional email + admin alerts |
| `PROXY_SHARED_SECRET` | both | lets the Next.js proxy pass the visitor IP to the API for rate limiting |
| `BACKEND_URL` or `BACKEND_HOSTPORT` | web | where Next.js reaches the API |

## Deploy to Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. Render reads `render.yaml` and creates `xotiictech-db`, `xotiictech-api` and `xotiictech-web`.
3. Fill in the prompted secrets: admin values, Stripe, R2, Resend, `DISCORD_BOT_TOKENS`. `SECRET_KEY` and `PROXY_SHARED_SECRET` are generated automatically.
4. The first deploy runs `alembic upgrade head` (preDeploy). Optionally seed once from the API's **Shell** tab: `python -m app.scripts.seed`.
5. **Custom domain:** in `xotiictech-web` → Settings → Custom Domains, follow the DNS instructions for `xotiictech.com` and `www`. Render issues TLS automatically. HTTPS and HSTS are enforced by both apps.
6. Finish the integrations:
   - [Stripe setup](docs/STRIPE_SETUP.md) (webhook → `https://xotiictech.com/api/webhooks/stripe`)
   - [R2 storage setup](docs/STORAGE_SETUP.md)
   - [Discord bot sync setup](docs/DISCORD_SYNC.md)
7. Visit `https://xotiictech.com/xotiic` and sign in with username, password and your authenticator code.

> `preDeployCommand` requires a paid instance type (Starter or above). On the free tier, move `alembic upgrade head &&` to the front of the API's `startCommand` instead.

## Security summary

- **Secrets:** all secrets live in Render env vars. Discord tokens are only used server-side, are fingerprinted (sha256) for health tracking, and are scrubbed from logs by a redaction filter.
- **Admin:** env-based credentials, bcrypt, **mandatory TOTP** with replay protection, 5/min + 20/hour login rate limit, 8-hour `SameSite=Strict` httpOnly session. Sessions die automatically when the password hash changes. CSRF uses a double-submit token. There's an optional IP allowlist, and every admin action is recorded in the audit log.
- **Buyers:** magic-link sign-in (single-use, 15 minutes, stored hashed) with optional password. There's no open registration, so nobody can pre-claim someone else's email.
- **Requests:** Pydantic validation server-side and zod client-side. Origin checks on state-changing requests, CORS locked to your domain, slowapi limits on auth, contact, commission, checkout and newsletter, and honeypots on public forms.
- **Files:** uploads are checked by MIME type, extension, size and magic bytes. Deliverables sit in a private bucket and buyers only ever receive 5-minute presigned URLs behind a signed, expiring download token.
- **Payments:** Stripe webhook signatures are verified, and fulfilment is idempotent.
- **Headers:** HSTS, CSP, `X-Frame-Options: DENY`, `nosniff`, a strict Referrer-Policy, and `no-store` on authenticated API responses.

## Editing content

Almost everything is editable in `/xotiic`: products, bots (overrides, media, command visibility), portfolio, blog (including changelog entries), docs/FAQ, testimonials, and **Site content** (hero text, ticker, stats overrides, socials, footer, legal pages, and the **Free tools** list, which drives the R6XScan PC-checker banner, `/tools`, and the nav/footer links).

## Future enhancements

- **Dedicated "sync bot":** add one extra bot that sits in all your support servers to pull member counts and real gateway presence. Today, "online" means "the token authenticated successfully during the last sync".
- Redis-backed rate limiting (`storage_uri` in `app/core/ratelimit.py`) if you scale the API beyond one instance.
- Automated hosted-bot deployment (v1 is a manual approve → deploy flow).
- Discount codes (Stripe promotion codes can be enabled with `allow_promotion_codes=True`).
