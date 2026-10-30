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

# ── Doc page bodies ──

DOC_VENDINGX_OVERVIEW = """\
## What is Vending X?

Vending X is a Discord bot that turns your server into a digital vending machine. \
Load items (accounts, keys, links, codes) into text files, and your members can \
dispense them through an interactive vending machine interface.

### Two Tiers

- **Beta** — Free items anyone in the server can vend
- **Premium** — Items gated behind a premium role (purchasable via Stripe or assigned manually)

### Key Features

- Interactive vending machine UI with buttons and dropdown menus
- Stock is dispensed privately via DM
- Auto-update panels that show live stock counts in designated channels
- Built-in cooldowns to prevent spam
- Full audit logging of every dispense
- Premium role gating with Stripe integration

### Getting Started

- **Use the bot on our server**: Join the [XotiicTech Discord](https://discord.gg/xotiictech) and use `/vend`
- **Use it on the website**: Visit [xotiictech.net/vendingx](/vendingx) to vend directly from the web
- **Run your own**: Purchase [Bot Access](/store/vendingx-bot-access) for the full source code
"""

DOC_VENDINGX_SETUP = """\
## Setting Up Vending X

This guide covers setting up your own Vending X bot after purchasing Bot Access.

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and name it
3. Go to the **Bot** tab and click **Reset Token** — save the token securely
4. Enable all three **Privileged Gateway Intents** (Presence, Server Members, Message Content)
5. Go to **OAuth2 > URL Generator**, select `bot` + `applications.commands`
6. Under Bot Permissions select: Send Messages, Embed Links, Attach Files, Read Message History, Use Slash Commands, Manage Roles
7. Copy the URL and invite the bot to your server

### 2. Configure Environment Variables

Create a `.env` file in the bot root:

```
DISCORD_BOT_TOKEN=your_token_here
BOT_OWNER_ID=your_discord_user_id
MAIN_SERVER_ID=your_server_id
PREMIUM_ROLE_ID=your_premium_role_id
```

### 3. Add Stock

Drop `.txt` files into the `stock/` folder. One item per line. \
Files prefixed with `premium_` require premium access.

```
stock/epicgames.txt      → free tier
stock/premium_nitro.txt  → premium only
```

### 4. Run the Bot

```bash
pip install -r requirements.txt
python main.py
```

The bot syncs slash commands on startup. Use `/vending beta` or `/vending premium` to post a panel.

### 5. Host on Discloud

See the [Discloud Hosting Guide](/docs/vendingx-discloud) for step-by-step instructions.
"""

DOC_VENDINGX_COMMANDS = """\
## Vending X Command Reference

All commands are Discord slash commands. They sync automatically when the bot starts.

### Public Commands

Users interact with the vending machine through the **button and dropdown UI** posted by `/vending`. \
There are no public slash commands — vending is done through the interactive panels.

### Admin Commands

| Command | Description |
|---------|-------------|
| `/vending <tier>` | Post a vending machine panel. Choose `beta` (free) or `premium` (role-gated). |
| `/setbuy` | Post the pricing embed with buttons linking to Stripe checkout. |
| `/setup` | Configure auto-update channels, roles, and notification settings. |

### Owner Commands

| Command | Description |
|---------|-------------|
| `/addstock <file>` | Upload a `.txt` file attachment to add items to stock. The filename becomes the stock type. |
| `/clearstock <type>` | Remove all items for a stock type. |
| `/panel` | View a dashboard showing total stock, dispensed counts, and bot stats. |

### Notes

- **Admin** commands require the `Administrator` permission in Discord
- **Owner** commands are restricted to the bot owner (`BOT_OWNER_ID` in `.env`)
- Stock type names are derived from filenames: `epicgames.txt` → type `epicgames`
- Premium types must be prefixed with `premium_`: `premium_nitro.txt`
"""

DOC_VENDINGX_STOCK = """\
## Managing Stock

Stock is the inventory your vending machine dispenses. Each stock type is a text file in the `stock/` folder.

### File Format

One item per line. Each line is one dispensable unit:

```
email1@example.com:password123
email2@example.com:password456
email3@example.com:password789
```

Items are dispensed top-to-bottom. When a line is dispensed, it's removed from the file.

### Stock Types

The filename determines the stock type and tier:

| Filename | Type | Tier |
|----------|------|------|
| `epicgames.txt` | epicgames | Beta (free) |
| `steam.txt` | steam | Beta (free) |
| `premium_nitro.txt` | premium_nitro | Premium |
| `premium_spotify.txt` | premium_spotify | Premium |

Any file starting with `premium_` requires the premium role to vend.

### Adding Stock

**Via file**: Drop a `.txt` file into the `stock/` folder and restart the bot (or wait for the 5-minute auto-update).

**Via command**: Use `/addstock` and attach a `.txt` file. The bot adds the lines to the existing stock.

### Monitoring Stock

- The auto-update panels show live counts every 5 minutes
- Use `/panel` for a full stats overview
- The website at `/vendingx` also shows current stock levels
"""

DOC_VENDINGX_DISCLOUD = """\
## Hosting on Discloud

[Discloud](https://discloud.com) is a free hosting platform for Discord bots. Here's how to deploy Vending X.

### 1. Create discloud.config

Add this file to your bot's root folder:

```
ID=auto
TYPE=bot
MAIN=main.py
RAM=512
VERSION=v3.10
AUTORESTART=true
```

### 2. Prepare the Zip

Zip the **contents** of your bot folder (not the folder itself):

```
main.py
requirements.txt
discloud.config
bot/
web/
stock/
```

**Do NOT include** `.env` or `data/` in the zip.

### 3. Upload to Discloud

1. Go to [discloud.com](https://discloud.com) and sign in
2. Click **Add App** and upload your zip
3. Go to your app's settings and add your environment variables:
   - `DISCORD_BOT_TOKEN`
   - `BOT_OWNER_ID`
   - `MAIN_SERVER_ID`
   - `PREMIUM_ROLE_ID` (optional)
4. Start the bot

### 4. Updating

To update the bot, create a new zip with your changes and use Discloud's **Commit** feature to upload it. \
Your environment variables and data persist between updates.

### Troubleshooting

- **Bot goes offline**: Check RAM. Increase from 512 to 1024 if needed.
- **Commands not syncing**: Restart the bot from the dashboard. Commands sync on startup.
- **Stock not loading**: Make sure your `.txt` files are included in the zip under `stock/`.
"""

DOC_FAQ_PREMIUM = """\
Premium unlocks access to premium-tier stock items in the Vending X vending machine. \
Beta items are free for everyone — premium items are gated behind a Discord role.

**How to get Premium:**
- Purchase it for $3 on the [store](/store/vendingx-premium) or the [Vending X page](/vendingx)
- After payment, the premium role is automatically assigned to your Discord account
- You can then vend premium items through the bot or the website

Premium is a one-time purchase — no subscription.
"""

DOC_FAQ_ADDSTOCK = """\
Create a `.txt` file with one item per line and drop it into the `stock/` folder. \
The filename becomes the stock type name.

For example, `epicgames.txt` with contents:
```
account1@email.com:pass1
account2@email.com:pass2
```

You can also use the `/addstock` command in Discord and attach a `.txt` file. \
Prefix filenames with `premium_` to make them premium-only (e.g., `premium_nitro.txt`).

Stock updates are picked up automatically every 5 minutes, or immediately on bot restart.
"""

DOC_FAQ_CUSTOMIZE = """\
Yes! You own the full source code. You can:

- Change the bot's name, avatar, and status message
- Modify embed colors, text, and formatting
- Add new stock types by dropping `.txt` files in `stock/`
- Change cooldown timers and rate limits
- Add or remove commands
- Modify the premium role logic

The bot is written in Python with discord.py — if you know Python, you can customize anything. \
If you need help, join the [XotiicTech Discord](https://discord.gg/xotiictech).
"""

DOC_FAQ_DISCLOUD_HOST = """\
Yes! Discloud offers a free tier that works perfectly for Vending X:

1. Create a `discloud.config` file (see the [Discloud guide](/docs/vendingx-discloud))
2. Zip your bot files (without `.env`)
3. Upload at [discloud.com](https://discloud.com)
4. Set your environment variables in the dashboard
5. Start the bot

The free tier gives you 512MB RAM which is enough for most servers. \
If you have a lot of stock or a very active server, you may need to upgrade to a paid plan.
"""

DOC_FAQ_DOWNLOAD = """\
Sign in at [/account](/account) with the same email you used to purchase. \
Click **Download** next to your order to generate a fresh download link.

Download links expire after a set time for security, but you can always generate a new one from your account page.
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
            title="Getting started", section="guides", is_published=True, sort_order=0,
            body="## After purchase\n\n1. Check your email for the download link.\n"
            "2. Lost it? Sign in at **/account** with the same email.\n3. Follow the product's setup guide.",
        )
        upsert_by_slug(
            db, DocPage, "vendingx-overview",
            title="Vending X Overview", section="guides", is_published=True, sort_order=10,
            body=DOC_VENDINGX_OVERVIEW,
        )
        upsert_by_slug(
            db, DocPage, "vendingx-setup",
            title="Vending X Bot Setup", section="guides", is_published=True, sort_order=11,
            body=DOC_VENDINGX_SETUP,
        )
        upsert_by_slug(
            db, DocPage, "vendingx-commands",
            title="Vending X Commands", section="guides", is_published=True, sort_order=12,
            body=DOC_VENDINGX_COMMANDS,
        )
        upsert_by_slug(
            db, DocPage, "vendingx-stock",
            title="Managing Stock", section="guides", is_published=True, sort_order=13,
            body=DOC_VENDINGX_STOCK,
        )
        upsert_by_slug(
            db, DocPage, "vendingx-discloud",
            title="Hosting on Discloud", section="guides", is_published=True, sort_order=14,
            body=DOC_VENDINGX_DISCLOUD,
        )
        upsert_by_slug(
            db, DocPage, "faq-download-expired",
            title="My download link expired — what now?", section="faq", is_published=True, sort_order=0,
            body=DOC_FAQ_DOWNLOAD,
        )
        upsert_by_slug(
            db, DocPage, "faq-what-is-premium",
            title="What is Vending X Premium?", section="faq", is_published=True, sort_order=1,
            body=DOC_FAQ_PREMIUM,
        )
        upsert_by_slug(
            db, DocPage, "faq-add-stock",
            title="How do I add stock to Vending X?", section="faq", is_published=True, sort_order=2,
            body=DOC_FAQ_ADDSTOCK,
        )
        upsert_by_slug(
            db, DocPage, "faq-customize-bot",
            title="Can I customize the bot?", section="faq", is_published=True, sort_order=3,
            body=DOC_FAQ_CUSTOMIZE,
        )
        upsert_by_slug(
            db, DocPage, "faq-discloud-hosting",
            title="Can I host the bot for free on Discloud?", section="faq", is_published=True, sort_order=4,
            body=DOC_FAQ_DISCLOUD_HOST,
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
