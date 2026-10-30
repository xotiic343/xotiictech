"""Vending X — entry point.

Starts the Discord bot and the FastAPI web server concurrently.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from pathlib import Path

import discord
import uvicorn
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("vendingx")

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
if not TOKEN:
    raise ValueError("Set DISCORD_BOT_TOKEN in .env")

API_PORT = int(os.getenv("API_PORT", "5000"))

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


@bot.event
async def on_ready() -> None:
    """Sync slash commands and start background workers."""
    log.info("Logged in as %s (%s)", bot.user, bot.user.id)

    await bot.load_extension("bot.bot")

    try:
        synced = await bot.tree.sync()
        log.info("Synced %d slash commands", len(synced))
    except Exception as exc:
        log.error("Command sync failed: %s", exc)

    from bot import logging as dmlog
    dmlog.start(bot)
    log.info("DM log worker started")


def _run_web() -> None:
    """Run the FastAPI server in a background thread."""
    from web.server import create_app
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=API_PORT, log_level="info")


if __name__ == "__main__":
    print("=" * 60)
    print("  VENDING X — by Xotiic Tech")
    print("=" * 60)
    print(f"  Stock dir : {Path('stock').resolve()}")
    print(f"  Data dir  : {Path('data').resolve()}")
    print(f"  Web port  : {API_PORT}")
    print("=" * 60)

    web_thread = threading.Thread(target=_run_web, daemon=True)
    web_thread.start()
    log.info("Web server starting on port %d", API_PORT)

    bot.run(TOKEN)
