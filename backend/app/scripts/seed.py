"""Seed sample content: product, bot, blog post, docs, testimonial, legal pages.

    python -m app.scripts.seed

Idempotent: rows are matched by slug and skipped if present. The admin account is configured via
env vars — run `python -m app.scripts.create_admin` for that.
"""

from datetime import datetime, timezone

from sqlalchemy import select

from app.db import SessionLocal
from app.models import BlogPost, Bot, BotCommand, DocPage, Product, Testimonial
from app.services import site_settings

NOW = datetime.now(timezone.utc)

LEGAL = {
    "terms": """## Terms of Service

By purchasing or using XotiicTech products you agree to these terms.

1. **Licence.** Purchases grant a personal, non-transferable licence unless the product page states otherwise. Source-code purchases may be modified for your own projects but not resold or redistributed as-is.
2. **Delivery.** Digital products are delivered instantly via a download link that expires after a limited time. Signed-in buyers can generate a fresh link from their account.
3. **Hosted bots.** Hosted instances are provided on a best-effort basis. Abuse of Discord's Terms of Service will result in termination without refund.
4. **Liability.** Software is provided "as is" without warranty. XotiicTech is not liable for damages arising from use of its products.
5. **Changes.** These terms may be updated; continued use constitutes acceptance.

*Replace this placeholder with terms reviewed for your jurisdiction.*""",
    "privacy": """## Privacy Policy

We collect only what we need to deliver your purchases and run the site:

- **Account & order data:** email, purchase history, Discord server ID for hosted bots.
- **Payments:** processed by Stripe. We never see or store your card details.
- **Analytics:** anonymous page-view counts (path + referrer). No third-party trackers.
- **Emails:** transactional emails via our email provider. Newsletter only if you opt in.

Contact us to request export or deletion of your data.

*Replace this placeholder with a policy reviewed for your jurisdiction (GDPR/CCPA as applicable).*""",
    "refund_policy": """## Refund Policy

Because digital goods are delivered instantly, **all sales are final once the file has been downloaded**, except where required by law.

- Not downloaded yet? Request a refund within **14 days** of purchase.
- Product broken or not as described? Contact us within 14 days — we'll fix it or refund you.
- Hosted bots: pro-rated refunds for unused time on request.

Refunds are issued to the original payment method via Stripe.""",
    "licenses": """## Licenses

**Standard licence** — use in your own servers/projects, unlimited personal use.

**Source licence** — modify and self-host. No resale or redistribution of the code as a product.

**Commercial licence** — available on request for agencies and resellers.

Open-source components used in our products retain their original licences (MIT, Apache-2.0, etc.).""",
}

BOT_ACCESS_DESC = """\
## What You Get

The full **Vending X** Discord bot source code — the same bot that powers the vending machine on this site. \
Run it on your own server with your own stock, your own branding, and full control.

**You receive the bot only** — the website/frontend is not included.

---

## How It Works

Vending X is a stock-dispensing vending machine bot for Discord. You load `.txt` files into a `stock/` folder \
(one item per line), and the bot serves them through interactive slash commands with a vending-machine UI.

- **Beta tier** — free items anyone can vend
- **Premium tier** — gated behind a Discord role you control
- Stock is dispensed via DM so items stay private
- Auto-update panels post live stock counts to channels you pick

---

## Tech Stack

| Component | Detail |
|-----------|--------|
| Language | Python 3.10+ |
| Framework | discord.py 2.4+ |
| Database | SQLite (zero config) |
| Commands | Slash commands (synced automatically) |
| UI | Persistent views with buttons and selects |

---

## Included Commands

| Command | Access | What it does |
|---------|--------|-------------|
| `/vending` | Admin | Post the vending machine panel (beta or premium) |
| `/setbuy` | Admin | Post the pricing / buy embed |
| `/addstock` | Owner | Upload a `.txt` file to add stock |
| `/clearstock` | Owner | Wipe all stock for a type |
| `/panel` | Owner | View bot stats and stock overview |
| `/setup` | Admin | Configure auto-update channels and roles |

---

## Hosting

### Discloud (recommended — free tier available)

1. Create a `discloud.config` with `TYPE=bot`, `MAIN=main.py`, `RAM=512`
2. Zip the bot folder (without `.env`)
3. Upload at discloud.com and set your env vars in the dashboard

### Your own PC

1. Install Python 3.10+
2. Run `pip install -r requirements.txt`
3. Create a `.env` with your bot token and settings
4. Run `python main.py`

Full step-by-step instructions are on the **[Setup Guide](/vendingx/setup)**.

---

## After Purchase

1. You'll receive a download link for the bot source code (`.zip`)
2. Follow the setup guide to create a Discord bot application
3. Configure your `.env` file with your bot token
4. Add stock files and start the bot
5. Future updates are free — re-download anytime from your account
"""

# ── Doc page bodies (customer-facing) ──

DOC_GETTING_STARTED = """\
## Welcome to XotiicTech

Thanks for your purchase! Here's how to get started.

### 1. Check Your Email

After payment, you'll receive a confirmation email with a download link. \
The link is valid for a limited time — if it expires, you can always get a fresh one from your account.

### 2. Sign In to Your Account

Go to [My Account](/account) and sign in with the same email you used at checkout. \
From there you can:

- Re-download any product you've purchased
- View your order history
- Access your license keys

### 3. Need Help?

- Browse the [Docs & FAQ](/docs) for answers to common questions
- Join the [XotiicTech Discord](https://discord.gg/xotiictech) for live support
- Use the [Contact](/contact) page to reach us directly
"""

DOC_HOW_TO_PURCHASE = """\
## How to Buy

All purchases on XotiicTech are handled securely through **Stripe**.

### Steps

1. Find a product in the [Store](/store)
2. Click **Buy Now** on the product page
3. Complete checkout — we accept all major credit/debit cards
4. You'll be redirected to a confirmation page with your download link
5. A confirmation email is also sent to the email you provide at checkout

### After Purchase

Your product is available immediately. Digital downloads can be accessed from the \
confirmation page or from your [Account](/account) page at any time.

### Refunds

All sales are final once the file has been downloaded. If you haven't downloaded yet, \
you can request a refund within 14 days. See our [Refund Policy](/legal/refund_policy) for details.
"""

DOC_ACCOUNT = """\
## Your Account

Your XotiicTech account is created automatically when you make your first purchase.

### Signing In

Sign in at [/account](/account) using the email address you used at checkout. \
We use a secure magic-link system — no password needed.

### What You Can Do

- **View orders** — See all your past purchases and their status
- **Re-download** — Generate fresh download links for any product
- **Access licenses** — View license keys and activation details

### Trouble Signing In?

Make sure you're using the same email you entered during checkout. \
If you still can't access your account, [contact us](/contact) and we'll sort it out.
"""

DOC_VENDING_X = """\
## Using Vending X

Vending X is a free digital vending machine where you can grab items like game accounts, \
gift links, and other digital goods.

### On the Website

Visit [xotiictech.net/vendingx](/vendingx) to use the vending machine directly from your browser.

1. Sign in with your Discord account
2. Select a slot from the machine
3. Press **VEND** to dispense your item
4. Copy the item from the tray — it's yours!

### In Discord

Join the [XotiicTech Discord](https://discord.gg/xotiictech) and interact with the \
vending machine panels in the stock channels. Press a button, pick an item from the \
dropdown, and the bot DMs you the content.

### Beta vs Premium

- **Beta items** are free for everyone
- **Premium items** require a Premium role — grab it for $3 on the [Vending X page](/vendingx) or the [Store](/store/vendingx-premium)

### Cooldowns

There's a short cooldown between vends to keep things fair for everyone. \
Wait a few seconds and try again.
"""

DOC_PRODUCTS_OVERVIEW = """\
## Our Products

XotiicTech builds and sells Discord bots, source code, and digital tools.

### Discord Bots

Custom-built Discord bots with slash commands, interactive UIs, and full documentation. \
Available as hosted instances or full source code you can run yourself.

- [Vending X — Bot Access](/store/vendingx-bot-access) — Run your own vending machine bot
- [Vending X — Premium](/store/vendingx-premium) — Unlock premium vending items

### What's Included

Every product comes with:

- Instant digital delivery
- Documentation and setup instructions
- Free updates (re-download from your account)
- Support via our [Discord server](https://discord.gg/xotiictech)

### Custom Bots

Need something built from scratch? We take commissions. \
Visit the [Commission](/bots/commission) page to request a quote.
"""

DOC_FAQ_DOWNLOAD = """\
Sign in at [/account](/account) with the same email you used to purchase. \
Click **Download** next to your order to generate a fresh download link.

Download links expire for security, but you can always generate a new one from your account.
"""

DOC_FAQ_PAYMENT = """\
We accept all major credit and debit cards through Stripe, including Visa, Mastercard, \
Amex, and Discover. Apple Pay and Google Pay are also supported at checkout.

All transactions are encrypted and processed securely — we never see or store your card details.
"""

DOC_FAQ_REFUND = """\
Because digital goods are delivered instantly, all sales are final once the file has been downloaded.

If you **haven't downloaded** yet, you can request a refund within 14 days of purchase. \
If the product is broken or not as described, contact us within 14 days and we'll fix it or refund you.

See our full [Refund Policy](/legal/refund_policy) for details.
"""

DOC_FAQ_PREMIUM = """\
Vending X Premium unlocks access to premium-tier items in the vending machine. \
Beta items are free for everyone — premium items are exclusive.

**How to get it:**
- Purchase for $3 on the [Store](/store/vendingx-premium) or the [Vending X page](/vendingx)
- Your Discord account gets the Premium role automatically after payment
- Vend premium items through the bot or the website immediately

It's a one-time purchase — no subscription, no recurring charges.
"""

DOC_FAQ_SUPPORT = """\
The fastest way to get help is through our Discord server:

1. Join at [discord.gg/xotiictech](https://discord.gg/xotiictech)
2. Head to the support channel
3. Describe your issue and we'll help you out

You can also reach us through the [Contact](/contact) page on the website. \
We typically respond within 24 hours.
"""

DOC_FAQ_BOT_ACCESS = """\
When you purchase Bot Access, you get the **full source code** of the Vending X bot. \
This is the complete bot — not a hosted instance.

**What's included:**
- All Python source files
- Every command and feature
- Complete setup guide at [/vendingx/setup](/vendingx/setup)
- Free updates (re-download from your account when new versions drop)

**What's NOT included:**
- The website / web frontend
- Hosting (you host it yourself on Discloud, a VPS, or your PC)

After purchase you'll receive a download link for the `.zip` file. Follow the setup guide to get it running.
"""


def upsert_by_slug(db, model, slug: str, **fields):
    obj = db.scalar(select(model).where(model.slug == slug))
    if obj:
        changed = False
        for k, v in fields.items():
            if hasattr(obj, k) and getattr(obj, k) != v:
                setattr(obj, k, v)
                changed = True
        if changed:
            db.flush()
            print(f"  ~ {model.__tablename__}/{slug} updated")
        else:
            print(f"  = {model.__tablename__}/{slug} unchanged")
        return obj
    obj = model(slug=slug, **fields)
    db.add(obj)
    db.flush()
    print(f"  + {model.__tablename__}/{slug}")
    return obj


def main() -> None:
    with SessionLocal() as db:
        print("Seeding XotiicTech sample data…")

        bot = db.scalar(select(Bot).where(Bot.discord_id == "100000000000000001"))
        if not bot:
            bot = Bot(
                discord_id="100000000000000001",
                application_id="100000000000000001",
                username="XotiicGuard",
                slug="xotiicguard",
                app_description="Moderation & anti-raid bot with audit logs, auto-mod and ticket system.",
                app_tags=["moderation", "anti-raid", "tickets"],
                install_scopes=["bot", "applications.commands"],
                install_permissions="1099511627775",
                guild_count=128,
                status="online",
                last_synced_at=NOW,
                first_seen_at=NOW,
                short_description="Moderation & anti-raid that never sleeps.",
                long_description=(
                    "## XotiicGuard\n\nA sample bot created by the seed script. Real bots are imported "
                    "automatically from `DISCORD_BOT_TOKENS`.\n\n- Raid detection\n- Auto-mod filters\n"
                    "- Ticket panels\n- Full audit logging"
                ),
                category="Moderation",
                pricing_type="premium",
                price_label="from $9.99",
                is_featured=True,
                is_published=True,
                published_at=NOW,
                version="1.4.0",
                media=[],
            )
            db.add(bot)
            db.flush()
            for i, (name, desc) in enumerate(
                [("ban", "Ban a member"), ("ticket", "Open a support ticket"), ("lockdown", "Lock all channels"),
                 ("automod", "Configure auto-moderation")],
                start=1,
            ):
                db.add(BotCommand(bot_id=bot.id, discord_command_id=f"90000000000000000{i}", name=name, description=desc))
            print("  + bots/xotiicguard (sample — delete once your real bots sync)")

        upsert_by_slug(
            db, Product, "xotiicguard-source",
            name="XotiicGuard — Source Code",
            tagline="Full Python source of the XotiicGuard moderation bot.",
            description="## What you get\n\n- Complete, documented source\n- Setup guide\n- 6 months of updates",
            features=["discord.py 2.x", "PostgreSQL storage", "Docker-ready", "Slash commands"],
            category="discord_bots", sell_type="source_code", price_cents=2999, currency="usd",
            version="1.4.0", is_published=True, is_featured=True, is_bot=True, bot_id=bot.id, media=[],
        )
        upsert_by_slug(
            db, Product, "vendingx-premium",
            name="Vending X — Premium Access",
            tagline="Unlock all premium stock items in the Vending X bot.",
            description="## Premium Access\n\nOne-time payment to unlock all premium stock items in the Vending X vending machine bot. Instant access after purchase.",
            features=["All premium stock items", "Instant access", "One-time payment", "Discord role"],
            category="discord_bots", sell_type="license", price_cents=300, currency="usd",
            is_published=True, is_featured=False, media=[],
        )
        upsert_by_slug(
            db, Product, "vendingx-bot-access",
            name="Vending X — Bot Access",
            tagline="Full source code for the Vending X vending machine bot. Host it yourself on Discloud or your PC.",
            description=BOT_ACCESS_DESC,
            features=[
                "Full Python source code",
                "All slash commands included",
                "Stock file management system",
                "Auto-update stock panels",
                "Premium tier with role gating",
                "Persistent Discord UI views",
                "SQLite database (zero config)",
                "Complete setup guide",
                "Discloud hosting guide",
                "Free updates via re-download",
            ],
            category="discord_bots", sell_type="download", price_cents=5000, currency="usd",
            version="1.0.0",
            is_published=True, is_featured=True, media=[],
        )
        upsert_by_slug(
            db, BlogPost, "hello-world",
            title="XotiicTech is online",
            excerpt="The new XotiicTech platform is live: store, bots, docs and more.",
            body="## Welcome\n\nThe new site is live. Bots now sync automatically from Discord, "
            "downloads are instant, and there's a free R6 PC checker at [r6xscan](https://r6xscan.vercel.app/).",
            kind="announcement", tags=["news"], is_published=True, published_at=NOW,
        )
        upsert_by_slug(
            db, BlogPost, "v1-0-0",
            title="v1.0.0 — Platform launch",
            excerpt="Initial release.",
            body="- Store with instant delivery\n- Auto-synced Discord bot showcase\n- Buyer accounts",
            kind="changelog", tags=["release"], is_published=True, published_at=NOW,
        )
        upsert_by_slug(
            db, DocPage, "getting-started",
            title="Getting Started", section="guides", is_published=True, sort_order=0,
            body=DOC_GETTING_STARTED,
        )
        upsert_by_slug(
            db, DocPage, "how-to-purchase",
            title="How to Buy", section="guides", is_published=True, sort_order=1,
            body=DOC_HOW_TO_PURCHASE,
        )
        upsert_by_slug(
            db, DocPage, "your-account",
            title="Your Account", section="guides", is_published=True, sort_order=2,
            body=DOC_ACCOUNT,
        )
        upsert_by_slug(
            db, DocPage, "using-vending-x",
            title="Using Vending X", section="guides", is_published=True, sort_order=3,
            body=DOC_VENDING_X,
        )
        upsert_by_slug(
            db, DocPage, "our-products",
            title="Our Products", section="guides", is_published=True, sort_order=4,
            body=DOC_PRODUCTS_OVERVIEW,
        )
        upsert_by_slug(
            db, DocPage, "faq-download-expired",
            title="My download link expired — what now?", section="faq", is_published=True, sort_order=0,
            body=DOC_FAQ_DOWNLOAD,
        )
        upsert_by_slug(
            db, DocPage, "faq-payment-methods",
            title="What payment methods do you accept?", section="faq", is_published=True, sort_order=1,
            body=DOC_FAQ_PAYMENT,
        )
        upsert_by_slug(
            db, DocPage, "faq-refunds",
            title="Can I get a refund?", section="faq", is_published=True, sort_order=2,
            body=DOC_FAQ_REFUND,
        )
        upsert_by_slug(
            db, DocPage, "faq-what-is-premium",
            title="What is Vending X Premium?", section="faq", is_published=True, sort_order=3,
            body=DOC_FAQ_PREMIUM,
        )
        upsert_by_slug(
            db, DocPage, "faq-get-support",
            title="How do I get support?", section="faq", is_published=True, sort_order=4,
            body=DOC_FAQ_SUPPORT,
        )
        upsert_by_slug(
            db, DocPage, "faq-bot-access",
            title="What do I get with Bot Access?", section="faq", is_published=True, sort_order=5,
            body=DOC_FAQ_BOT_ACCESS,
        )
        if not db.scalar(select(Testimonial.id).limit(1)):
            db.add(Testimonial(name="Sample Client", role="Server owner, 12k members",
                               quote="Bot was delivered in a week and hasn't gone down once.", rating=5))
            print("  + testimonials/sample")

        legal = site_settings.get_content(db, "legal")
        if not any(legal.values()):
            site_settings.set_content(db, "legal", LEGAL)
            print("  + content/legal placeholders")

        db.commit()
        print("Done.")


if __name__ == "__main__":
    main()
