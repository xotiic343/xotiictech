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
    user_str = f"{user}" if isinstance(user, str) else f"{user} (`{user.id}`)"
    embed = discord.Embed(
        title="Vend Log",
        color=discord.Color.dark_red(),
        timestamp=datetime.now(timezone.utc),
    )
    embed.add_field(name="User", value=user_str, inline=True)
    embed.add_field(name="Product", value=product_name, inline=True)
    embed.add_field(name="Source", value=source, inline=True)
    if server_name:
        embed.add_field(name="Server", value=server_name, inline=True)
    embed.add_field(name="Left", value=f"`{remaining}`", inline=True)
    preview = payload_preview[:200] + ("..." if len(payload_preview) > 200 else "")
    embed.add_field(name="Content", value=f"```\n{preview}\n```", inline=False)
    return embed


async def _worker(bot: discord.Client) -> None:
    global _queue
    while True:
        embed = await _queue.get()
        try:
            owner = await bot.fetch_user(BOT_OWNER_ID)
            await owner.send(embed=embed)
        except (discord.Forbidden, discord.HTTPException) as exc:
            log.warning("DM failed (%s), trying fallback", exc)
            await _fallback(bot, embed)
        except Exception:
            log.exception("DM log error")
        finally:
            _queue.task_done()
        await asyncio.sleep(2)


async def _fallback(bot: discord.Client, embed: discord.Embed) -> None:
    guild = bot.get_guild(MAIN_SERVER_ID)
    if not guild:
        return

    from bot.db import get_db
    db = get_db()
    row = db.execute(
        "SELECT log_channel_id FROM vending_configs WHERE server_id = ?",
        (MAIN_SERVER_ID,),
    ).fetchone()
    if not row or not row[0]:
        return

    channel = guild.get_channel(row[0])
    if channel and isinstance(channel, discord.TextChannel):
        try:
            await channel.send(embed=embed)
        except discord.HTTPException:
            pass


def start(bot: discord.Client) -> None:
    global _queue, _task
    _queue = asyncio.Queue()
    _task = asyncio.create_task(_worker(bot))


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
    global _queue
    if _queue is None:
        start(bot)
    embed = _build_embed(
        user, product_name, stock_type, source, payload, remaining, server_name
    )
    await _queue.put(embed)
