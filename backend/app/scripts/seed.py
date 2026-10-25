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


def upsert_by_slug(db, model, slug: str, **fields):
    obj = db.scalar(select(model).where(model.slug == slug))
    if obj:
        print(f"  = {model.__tablename__}/{slug} exists, skipping")
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
            title="Getting started", section="guides", is_published=True,
            body="## After purchase\n\n1. Check your email for the download link.\n"
            "2. Lost it? Sign in at **/account** with the same email.\n3. Follow the product's setup guide.",
        )
        upsert_by_slug(
            db, DocPage, "faq-download-expired",
            title="My download link expired — what now?", section="faq", is_published=True,
            body="Sign in at /account with your purchase email and click **Download** for a fresh link.",
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
