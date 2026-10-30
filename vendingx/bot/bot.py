"""Main bot cog — all slash commands live here.

Commands:
  /vending            – interactive themed machine
  /vend <type>        – quick vend
  /stocklist          – inventory with LED indicators
  /mystats            – personal stats
  /leaderboard        – top users
  /addstock           – admin: upload .txt
  /removestock        – admin: clear stock
  /parse-preview      – admin: preview parser output
  /setformat          – admin: override parser format
  /setlogchannel      – admin: set fallback log channel
  /setupannounce      – admin: announcement config
  /setautoupdate      – admin: auto-update channel
  /ownerpanel         – owner stats
  /link               – one-time OAuth link for the web portal
"""

from __future__ import annotations

import logging
import os
import secrets
import time
from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands

from bot import stock, access, parser
from bot.access import cooldowns
from bot.db import get_db
from bot.views import VendingMachineView, build_machine_embed

log = logging.getLogger("vendingx.bot")

BOT_OWNER_ID = int(os.getenv("BOT_OWNER_ID", "1302203907782606880"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://xotiictech.net")

STOCK_TYPES: dict[str, dict] = {
    "steam":       {"name": "Steam Accounts",    "emoji": "🎮", "color": 0x1B2838, "description": "Steam game accounts"},
    "netflix":     {"name": "Netflix Accounts",   "emoji": "🎬", "color": 0xE50914, "description": "Netflix premium accounts"},
    "spotify":     {"name": "Spotify Accounts",   "emoji": "🎵", "color": 0x1DB954, "description": "Spotify premium accounts"},
    "discord":     {"name": "Discord Nitro",      "emoji": "💎", "color": 0x5865F2, "description": "Discord Nitro codes"},
    "minecraft":   {"name": "Minecraft Accounts", "emoji": "⛏️", "color": 0x62B47A, "description": "Minecraft Java accounts"},
    "roblox":      {"name": "Roblox Accounts",    "emoji": "🟥", "color": 0xE2231A, "description": "Roblox game accounts"},
    "epicgames":   {"name": "Epic Games",         "emoji": "⚡", "color": 0x313131, "description": "Epic Games accounts"},
    "ubisoft":     {"name": "Ubisoft",            "emoji": "🎯", "color": 0x0070FF, "description": "Ubisoft/Uplay accounts"},
    "instagram":   {"name": "Instagram",          "emoji": "📸", "color": 0xE1306C, "description": "Instagram accounts"},
    "onlyfans":    {"name": "OnlyFans",           "emoji": "🔞", "color": 0x00AFF0, "description": "OnlyFans premium accounts"},
    "mega":        {"name": "MEGA Links",         "emoji": "📁", "color": 0xD9272A, "description": "MEGA.nz file links"},
    "email":       {"name": "Email Accounts",     "emoji": "📧", "color": 0xEA4335, "description": "Email:password combinations"},
    "accounts":    {"name": "General Accounts",   "emoji": "👤", "color": 0x95A5A6, "description": "Various account types"},
    "combo":       {"name": "Combos",             "emoji": "🔐", "color": 0x9B59B6, "description": "Username:password combos"},
    "randomip":    {"name": "Random IP",          "emoji": "🌐", "color": 0x3498DB, "description": "Random IP addresses"},
    "random":      {"name": "Random Accounts",    "emoji": "🎲", "color": 0xE67E22, "description": "Random account types"},
    "premium_epicgames":     {"name": "Premium Epic Games",     "emoji": "✨", "color": 0xF1C40F, "description": "Premium Epic Games accounts"},
    "premium_instagram":     {"name": "Premium Instagram",      "emoji": "✨", "color": 0xF1C40F, "description": "Premium Instagram accounts"},
    "premium_onlyfans":      {"name": "Premium OnlyFans",       "emoji": "✨", "color": 0xF1C40F, "description": "Premium OnlyFans accounts"},
    "premium_phonenumbers":  {"name": "Premium Phone Numbers",  "emoji": "✨", "color": 0xF1C40F, "description": "Premium phone numbers"},
    "premium_randomip":      {"name": "Premium Random IP",      "emoji": "✨", "color": 0xF1C40F, "description": "Premium random IPs"},
    "premium_r6acc":         {"name": "Premium R6 Accounts",    "emoji": "✨", "color": 0xF1C40F, "description": "Premium Rainbow Six Siege accounts"},
    "premium_roblox":        {"name": "Premium Roblox",         "emoji": "✨", "color": 0xF1C40F, "description": "Premium Roblox accounts"},
    "premium_steam":         {"name": "Premium Steam",          "emoji": "✨", "color": 0xF1C40F, "description": "Premium Steam accounts"},
    "premium_ubisoft":       {"name": "Premium Ubisoft",        "emoji": "✨", "color": 0xF1C40F, "description": "Premium Ubisoft accounts"},
}


def _type_choices() -> list[app_commands.Choice[str]]:
    """Build autocomplete choices for stock type parameters."""
    return [app_commands.Choice(name=v["name"], value=k) for k, v in list(STOCK_TYPES.items())[:25]]


class VendingCog(commands.Cog):
    """All vending-machine slash commands."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="vending", description="🎰 Open the Vending X machine")
    async def vending(self, interaction: discord.Interaction) -> None:
        """Open the interactive vending machine."""
        embed = build_machine_embed()
        view = VendingMachineView(interaction.user.id, self.bot, get_db())
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="vend", description="🎰 Quick-vend a specific product")
    @app_commands.describe(stock_type="Product to vend")
    @app_commands.choices(stock_type=_type_choices())
    async def vend(self, interaction: discord.Interaction, stock_type: app_commands.Choice[str]) -> None:
        """Quick vend a single item."""
        st = stock_type.value
        db = get_db()

        if not access.has_access(self.bot, db, interaction.user.id):
            await interaction.response.send_message("🔒 You need premium access!", ephemeral=True)
            return

        on_cd, secs = cooldowns.check(interaction.user.id, "bot")
        if on_cd:
            await interaction.response.send_message(f"⏳ Wait `{secs}s`", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        info = STOCK_TYPES.get(st, {"name": st})
        entry = stock.dispense(st)
        if not entry:
            await interaction.followup.send(f"❌ **{info['name']}** is out of stock!", ephemeral=True)
            return

        cooldowns.set(interaction.user.id, "bot")
        remaining = stock.count(st)

        db.execute("INSERT OR IGNORE INTO users (id, username, total_generated) VALUES (?, ?, 0)", (interaction.user.id, str(interaction.user)))
        db.execute("INSERT INTO stock_usage (user_id, stock_type, stock_content, source, server_id) VALUES (?, ?, ?, 'BOT', ?)", (interaction.user.id, st, entry, interaction.guild_id))
        db.execute("UPDATE users SET total_generated = total_generated + 1 WHERE id = ?", (interaction.user.id,))
        db.commit()

        try:
            await interaction.user.send(f"🎁 **{info['name']}**\n```\n{entry}\n```")
            await interaction.followup.send(f"🎰 Vended **{info['name']}**! Check your DMs 📬", ephemeral=True)
        except discord.Forbidden:
            await interaction.followup.send(f"```\n{entry}\n```", ephemeral=True)

        from bot.logging import log_vend
        server_name = interaction.guild.name if interaction.guild else None
        await log_vend(self.bot, interaction.user, info["name"], st, "BOT", entry, remaining, server_name)

    @app_commands.command(name="stocklist", description="📦 View all available stock")
    async def stocklist(self, interaction: discord.Interaction) -> None:
        """List all stock with LED indicators."""
        embed = discord.Embed(title="📦 VENDING X — STOCK INVENTORY", color=discord.Color.blue())
        total = 0
        for st, info in STOCK_TYPES.items():
            cnt = stock.count(st)
            total += cnt
            if cnt == 0:
                status = "🔴 **EMPTY**"
            elif cnt < 5:
                status = f"🟡 `{cnt}` left"
            else:
                status = f"🟢 `{cnt}` left"
            name = f"✨ {info['name']}" if st.startswith("premium_") else info["name"]
            embed.add_field(name=f"{info['emoji']} {name}", value=status, inline=True)
        embed.set_footer(text=f"Total items: {total}")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="mystats", description="📊 Your vending stats")
    async def mystats(self, interaction: discord.Interaction) -> None:
        """Personal stats."""
        db = get_db()
        row = db.execute("SELECT total_generated FROM users WHERE id = ?", (interaction.user.id,)).fetchone()
        total = row[0] if row else 0
        total_rows = db.execute("SELECT COUNT(*) FROM stock_usage WHERE user_id = ?", (interaction.user.id,)).fetchone()[0]

        embed = discord.Embed(title=f"📊 {interaction.user.display_name}'s Stats", color=discord.Color.gold())
        embed.add_field(name="🎰 Total Vends", value=str(total), inline=True)
        embed.add_field(name="📦 Total Items", value=str(total_rows), inline=True)

        recent = db.execute("SELECT stock_type, generated_at FROM stock_usage WHERE user_id = ? ORDER BY generated_at DESC LIMIT 5", (interaction.user.id,)).fetchall()
        if recent:
            lines = [f"• **{STOCK_TYPES.get(r[0], {}).get('name', r[0])}** — {str(r[1])[:10]}" for r in recent]
            embed.add_field(name="🕐 Recent", value="\n".join(lines), inline=False)

        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="leaderboard", description="🏆 Top vending users")
    async def leaderboard(self, interaction: discord.Interaction) -> None:
        """Show top 10 users by total vends."""
        db = get_db()
        rows = db.execute("SELECT id, username, total_generated FROM users ORDER BY total_generated DESC LIMIT 10").fetchall()
        medals = ["🥇", "🥈", "🥉"]
        lines = []
        for i, (uid, uname, total) in enumerate(rows, 1):
            medal = medals[i - 1] if i <= 3 else f"`{i}.`"
            lines.append(f"{medal} <@{uid}> — **{total}** vends")
        embed = discord.Embed(title="🏆 TOP VENDERS", description="\n".join(lines) or "No data yet!", color=discord.Color.gold())
        await interaction.response.send_message(embed=embed)

    # ── Admin commands ──────────────────────────────────────

    @app_commands.command(name="addstock", description="➕ Add stock from a .txt file (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(stock_type="Stock type", file="Text file with entries (one per line)")
    @app_commands.choices(stock_type=_type_choices())
    async def addstock(self, interaction: discord.Interaction, stock_type: app_commands.Choice[str], file: discord.Attachment) -> None:
        """Upload stock from a .txt file."""
        if not interaction.user.guild_permissions.administrator and interaction.user.id != BOT_OWNER_ID:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return
        if not file.filename.endswith(".txt"):
            await interaction.response.send_message("❌ Upload a `.txt` file!", ephemeral=True)
            return

        content = (await file.read()).decode("utf-8", errors="ignore")
        entries = parser.auto_parse(stock_type.value, content)
        if not entries:
            await interaction.response.send_message("❌ No entries parsed!", ephemeral=True)
            return

        total = stock.add_entries(stock_type.value, entries)
        embed = discord.Embed(title="✅ Stock Added", description=f"Added **{len(entries)}** entries to **{stock_type.name}**\nTotal: `{total}`", color=discord.Color.green())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="removestock", description="🗑️ Clear a stock file (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.choices(stock_type=_type_choices())
    async def removestock(self, interaction: discord.Interaction, stock_type: app_commands.Choice[str]) -> None:
        """Clear all entries for a stock type."""
        if not interaction.user.guild_permissions.administrator and interaction.user.id != BOT_OWNER_ID:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return
        stock.clear(stock_type.value)
        await interaction.response.send_message(f"✅ Cleared **{stock_type.name}**!", ephemeral=True)

    @app_commands.command(name="parse-preview", description="🔍 Preview how a stock file is parsed (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.choices(stock_type=_type_choices())
    async def parse_preview(self, interaction: discord.Interaction, stock_type: app_commands.Choice[str]) -> None:
        """Preview the first 3 parsed entries for a stock type."""
        if not interaction.user.guild_permissions.administrator and interaction.user.id != BOT_OWNER_ID:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return

        p = stock.ensure_file(stock_type.value)
        raw = p.read_text(encoding="utf-8")
        fmt, entries = parser.preview_entries(stock_type.value, raw)

        desc = f"**Format:** `{fmt}`\n**Total entries:** `{len(parser.parse_entries(raw, fmt))}`\n\n"
        for i, e in enumerate(entries, 1):
            desc += f"**Entry {i}:**\n```\n{e[:300]}\n```\n"
        if not entries:
            desc += "*No entries found.*"

        embed = discord.Embed(title=f"🔍 Parse Preview: {stock_type.name}", description=desc, color=discord.Color.blue())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="setformat", description="⚙️ Override parser format (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.choices(stock_type=_type_choices())
    @app_commands.describe(format="Format: line, blank_separated, dash_separated, numbered, pipe_fields, key_value_block, comma_fields, tab_fields, url_per_line")
    async def setformat(self, interaction: discord.Interaction, stock_type: app_commands.Choice[str], format: str) -> None:
        """Manually override the detected format for a stock type."""
        if not interaction.user.guild_permissions.administrator and interaction.user.id != BOT_OWNER_ID:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return
        if parser.set_format(stock_type.value, format):
            await interaction.response.send_message(f"✅ Format for **{stock_type.name}** set to `{format}`", ephemeral=True)
        else:
            await interaction.response.send_message(f"❌ Invalid format! Valid: `{', '.join(parser.VALID_FORMATS)}`", ephemeral=True)

    @app_commands.command(name="setlogchannel", description="📋 Set vend-log fallback channel (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def setlogchannel(self, interaction: discord.Interaction, channel: discord.TextChannel) -> None:
        """Set the fallback logging channel."""
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return
        db = get_db()
        db.execute("INSERT OR REPLACE INTO vending_configs (server_id, log_channel_id) VALUES (?, ?)", (interaction.guild.id, channel.id))
        db.commit()
        await interaction.response.send_message(f"✅ Log channel → {channel.mention}")

    @app_commands.command(name="setupannounce", description="📢 Set announcement channel (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def setupannounce(self, interaction: discord.Interaction, channel: discord.TextChannel, role: discord.Role = None) -> None:
        """Set announcement channel and optional ping role."""
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return
        db = get_db()
        db.execute("INSERT OR REPLACE INTO vending_configs (server_id, announce_channel_id, announce_role_id) VALUES (?, ?, ?)", (interaction.guild.id, channel.id, role.id if role else None))
        db.commit()
        msg = f"✅ Announcements → {channel.mention}"
        if role:
            msg += f" | Ping: {role.mention}"
        await interaction.response.send_message(msg)

    @app_commands.command(name="setautoupdate", description="🔄 Set auto-update stock channel (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def setautoupdate(self, interaction: discord.Interaction, channel: discord.TextChannel, role: discord.Role = None) -> None:
        """Set the channel for automatic stock-count updates."""
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Admin only!", ephemeral=True)
            return
        db = get_db()
        db.execute("INSERT OR REPLACE INTO vending_configs (server_id, auto_update_channel_id, auto_update_role_id) VALUES (?, ?, ?)", (interaction.guild.id, channel.id, role.id if role else None))
        db.commit()
        msg = f"✅ Auto-update → {channel.mention}"
        if role:
            msg += f" | Ping: {role.mention}"
        await interaction.response.send_message(msg)

    @app_commands.command(name="ownerpanel", description="👑 Owner-only stats panel")
    async def ownerpanel(self, interaction: discord.Interaction) -> None:
        """Owner-only statistics dashboard."""
        if interaction.user.id != BOT_OWNER_ID:
            await interaction.response.send_message("❌ Owner only!", ephemeral=True)
            return
        db = get_db()
        total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_vends = db.execute("SELECT COUNT(*) FROM stock_usage").fetchone()[0]
        total_stock = sum(stock.count(st) for st in STOCK_TYPES)

        embed = discord.Embed(title="👑 Owner Panel", color=discord.Color.gold())
        embed.add_field(name="Servers", value=str(len(self.bot.guilds)), inline=True)
        embed.add_field(name="Users", value=str(total_users), inline=True)
        embed.add_field(name="Total Vends", value=str(total_vends), inline=True)
        embed.add_field(name="Total Stock", value=str(total_stock), inline=True)
        embed.add_field(name="Latency", value=f"{round(self.bot.latency * 1000, 2)}ms", inline=True)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="link", description="🔗 Get a one-time login link for the web portal")
    async def link(self, interaction: discord.Interaction) -> None:
        """Generate a one-time 5-minute OAuth link for the website."""
        token = secrets.token_urlsafe(32)
        db = get_db()
        expires = datetime.now(timezone.utc).timestamp() + 300
        db.execute(
            "INSERT INTO web_sessions (session_id, user_id, discord_username, expires_at) VALUES (?, ?, ?, ?)",
            (token, interaction.user.id, str(interaction.user), datetime.fromtimestamp(expires, tz=timezone.utc).isoformat()),
        )
        db.commit()
        url = f"{FRONTEND_URL}/vendingx/?token={token}"
        embed = discord.Embed(
            title="🔗 Web Portal Link",
            description=f"[Click here to open Vending X]({url})\n\n⏳ Expires in **5 minutes**.\nDo not share this link!",
            color=discord.Color.from_rgb(0, 229, 255),
        )
        try:
            await interaction.user.send(embed=embed)
            await interaction.response.send_message("📬 Link sent to your DMs!", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    """Register the VendingCog."""
    await bot.add_cog(VendingCog(bot))
    log.info("VendingCog loaded")
