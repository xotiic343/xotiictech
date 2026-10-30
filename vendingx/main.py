from __future__ import annotations

import asyncio
import logging
import os
import threading
from pathlib import Path

import discord
import uvicorn
from discord.ext import commands, tasks
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s")
log = logging.getLogger("vendingx")

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("DISCORD_BOT_TOKEN not set")

API_PORT = int(os.getenv("PORT", os.getenv("API_PORT", "5000")))

Path("stock").mkdir(exist_ok=True)
Path("data").mkdir(exist_ok=True)

from bot.db import init_db
init_db()

from bot.stock import ensure_file
from bot.bot import STOCK_TYPES
for st in STOCK_TYPES:
    ensure_file(st)

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

_update_msgs: dict[int, int] = {}


@bot.event
async def on_ready() -> None:
    log.info("Logged in as %s (%s)", bot.user, bot.user.id)

    await bot.load_extension("bot.bot")

    try:
        synced = await bot.tree.sync()
        log.info("Synced %d commands", len(synced))
    except Exception as exc:
        log.error("Sync failed: %s", exc)

    from bot import logging as dmlog
    dmlog.start(bot)

    if not auto_update.is_running():
        auto_update.start()

    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name="xotiictech.net/vendingx",
        )
    )


@tasks.loop(minutes=5)
async def auto_update() -> None:
    from bot.views import build_stock_embed
    from bot.db import get_db

    try:
        db = get_db()
        rows = db.execute(
            "SELECT auto_update_channel_id FROM vending_configs "
            "WHERE auto_update_channel_id IS NOT NULL"
        ).fetchall()

        if not rows:
            return

        embed = build_stock_embed()

        for (ch_id,) in rows:
            channel = bot.get_channel(ch_id)
            if not isinstance(channel, discord.TextChannel):
                continue

            msg_id = _update_msgs.get(ch_id)
            if msg_id:
                try:
                    msg = await channel.fetch_message(msg_id)
                    await msg.edit(embed=embed)
                    continue
                except discord.NotFound:
                    pass

            try:
                msg = await channel.send(embed=embed)
                _update_msgs[ch_id] = msg.id
            except discord.HTTPException:
                log.warning("Can't post to channel %s", ch_id)
    except Exception:
        log.exception("Auto-update failed")


@auto_update.before_loop
async def _wait_ready() -> None:
    await bot.wait_until_ready()


def _run_web() -> None:
    from web.server import create_app
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=API_PORT, log_level="info")


if __name__ == "__main__":
    web_thread = threading.Thread(target=_run_web, daemon=True)
    web_thread.start()
    log.info("Web API on port %d", API_PORT)
    bot.run(TOKEN)
