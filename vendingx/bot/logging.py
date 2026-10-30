"""Owner DM logging with rate-limiting and channel fallback.

Every vend (bot or web) queues a DM to BOT_OWNER_ID.  Messages are
rate-limited to one per 2 seconds.  If the DM fails (user has DMs off),
the bot falls back to the configured #vending-logs channel.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import discord

log = logging.getLogger("vendingx.dmlog")

BOT_OWNER_ID = int(os.getenv("BOT_OWNER_ID", "1302203907782606880"))
MAIN_SERVER_ID = int(os.getenv("MAIN_SERVER_ID", "1344385779627069541"))

_queue: asyncio.Queue | None = None
_task: asyncio.Task | None = None


def _build_embed(
    user: discord.User | str,
    product_name: str,
    stock_type: str,
    source: str,
    payload_preview: str,
    remaining: int,
    server_name: Optional[str] = None,
) -> discord.Embed:
    """Build the log embed sent to the owner."""
    user_str = f"{user}" if isinstance(user, str) else f"{user} (`{user.id}`)"
    embed = discord.Embed(
        title="🎰 Vend Log",
        color=discord.Color.from_rgb(0, 229, 255),
        timestamp=datetime.now(timezone.utc),
    )
    embed.add_field(name="User", value=user_str, inline=True)
    embed.add_field(name="Product", value=product_name, inline=True)
    embed.add_field(name="Type", value=f"`{stock_type}`", inline=True)
    embed.add_field(name="Source", value=source, inline=True)
    if server_name:
        embed.add_field(name="Server", value=server_name, inline=True)
    embed.add_field(name="Remaining", value=f"`{remaining}`", inline=True)
    preview = payload_preview[:200] + ("…" if len(payload_preview) > 200 else "")
    embed.add_field(name="Preview", value=f"```\n{preview}\n```", inline=False)
    return embed


async def _worker(bot: discord.Client) -> None:
    """Background worker: sends queued log embeds at <=1 per 2s."""
    global _queue
    while True:
        embed = await _queue.get()
        try:
            owner = await bot.fetch_user(BOT_OWNER_ID)
            await owner.send(embed=embed)
        except (discord.Forbidden, discord.HTTPException) as exc:
            log.warning("DM to owner failed (%s), trying fallback channel", exc)
            await _send_to_fallback(bot, embed)
        except Exception:
            log.exception("Unexpected error in DM log worker")
        finally:
            _queue.task_done()
        await asyncio.sleep(2)


async def _send_to_fallback(bot: discord.Client, embed: discord.Embed) -> None:
    """Send to the configured log channel in the main guild."""
    guild = bot.get_guild(MAIN_SERVER_ID)
    if not guild:
        log.error("Main guild not found for fallback logging")
        return

    from bot.db import get_db
    db = get_db()
    row = db.execute(
        "SELECT log_channel_id FROM vending_configs WHERE server_id = ?",
        (MAIN_SERVER_ID,),
    ).fetchone()
    if not row or not row[0]:
        log.error("No fallback log channel configured")
        return

    channel = guild.get_channel(row[0])
    if channel and isinstance(channel, discord.TextChannel):
        try:
            await channel.send(embed=embed)
        except discord.HTTPException:
            log.exception("Fallback channel send failed")


def start(bot: discord.Client) -> None:
    """Start the background log-worker task."""
    global _queue, _task
    _queue = asyncio.Queue()
    _task = asyncio.create_task(_worker(bot))
    log.info("DM log worker started")


async def log_vend(
    bot: discord.Client,
    user: discord.User | str,
    product_name: str,
    stock_type: str,
    source: str,
    payload: str,
    remaining: int,
    server_name: Optional[str] = None,
) -> None:
    """Queue a vend-log embed for delivery to the owner."""
    global _queue
    if _queue is None:
        start(bot)
    embed = _build_embed(user, product_name, stock_type, source, payload, remaining, server_name)
    await _queue.put(embed)
