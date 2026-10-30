from __future__ import annotations

import logging
import os
import secrets
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
    "steam":       {"name": "Steam",        "description": "Steam game accounts"},
    "netflix":     {"name": "Netflix",       "description": "Netflix premium accounts"},
    "spotify":     {"name": "Spotify",       "description": "Spotify premium accounts"},
    "discord":     {"name": "Discord Nitro", "description": "Discord Nitro codes"},
    "minecraft":   {"name": "Minecraft",     "description": "Minecraft Java accounts"},
    "roblox":      {"name": "Roblox",        "description": "Roblox game accounts"},
    "epicgames":   {"name": "Epic Games",    "description": "Epic Games accounts"},
    "ubisoft":     {"name": "Ubisoft",       "description": "Ubisoft accounts"},
    "instagram":   {"name": "Instagram",     "description": "Instagram accounts"},
    "onlyfans":    {"name": "OnlyFans",      "description": "OnlyFans premium"},
    "mega":        {"name": "MEGA",          "description": "MEGA.nz links"},
    "email":       {"name": "Emails",        "description": "Email:pass combos"},
    "accounts":    {"name": "Accounts",      "description": "Mixed accounts"},
    "combo":       {"name": "Combos",        "description": "User:pass combos"},
    "randomip":    {"name": "Random IPs",    "description": "Random IP addresses"},
    "random":      {"name": "Random",        "description": "Random accounts"},
    "premium_epicgames":    {"name": "Epic Games",    "description": "HQ Epic Games accounts"},
    "premium_instagram":    {"name": "Instagram",     "description": "HQ Instagram accounts"},
    "premium_onlyfans":     {"name": "OnlyFans",      "description": "HQ OnlyFans accounts"},
    "premium_phonenumbers": {"name": "Phone Numbers", "description": "Real phone numbers"},
    "premium_randomip":     {"name": "Random IPs",    "description": "Premium random IPs"},
    "premium_r6acc":        {"name": "R6 Siege",      "description": "HQ R6 Siege accounts"},
    "premium_roblox":       {"name": "Roblox",        "description": "HQ Roblox accounts"},
    "premium_steam":        {"name": "Steam",         "description": "HQ Steam accounts"},
    "premium_ubisoft":      {"name": "Ubisoft",       "description": "HQ Ubisoft accounts"},
}


def _type_choices() -> list[app_commands.Choice[str]]:
    return [app_commands.Choice(name=v["name"], value=k) for k, v in list(STOCK_TYPES.items())[:25]]


class VendingCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="vending", description="Open the machine")
    async def vending(self, interaction: discord.Interaction) -> None:
        embed = build_machine_embed()
        view = VendingMachineView(interaction.user.id, self.bot, get_db())
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="vend", description="Quick vend")
    @app_commands.describe(stock_type="What to vend")
    @app_commands.choices(stock_type=_type_choices())
    async def vend(self, interaction: discord.Interaction, stock_type: app_commands.Choice[str]) -> None:
        st = stock_type.value
        db = get_db()

        if not access.has_access(self.bot, db, interaction.user.id):
            await interaction.response.send_message(
                "You need premium access to vend.", ephemeral=True
            )
            return

        on_cd, secs = cooldowns.check(interaction.user.id, "bot")
        if on_cd:
            await interaction.response.send_message(
                f"Cooldown — `{secs}s` left.", ephemeral=True
            )
            return

        await interaction.response.defer(ephemeral=True)

        info = STOCK_TYPES.get(st, {"name": st})
        entry = stock.dispense(st)
        if not entry:
            await interaction.followup.send(
                f"**{info['name']}** is out of stock.", ephemeral=True
            )
            return

        cooldowns.set(interaction.user.id, "bot")
        remaining = stock.count(st)

        db.execute(
            "INSERT OR IGNORE INTO users (id, username, total_generated) VALUES (?, ?, 0)",
            (interaction.user.id, str(interaction.user)),
        )
        db.execute(
            "INSERT INTO stock_usage (user_id, stock_type, stock_content, source, server_id) "
            "VALUES (?, ?, ?, 'BOT', ?)",
            (interaction.user.id, st, entry, interaction.guild_id),
        )
        db.execute(
            "UPDATE users SET total_generated = total_generated + 1 WHERE id = ?",
            (interaction.user.id,),
        )
        db.commit()

        try:
            dm = discord.Embed(
                title=info["name"],
                description=f"```\n{entry}\n```",
                color=discord.Color.dark_red(),
            )
            dm.set_footer(text="Vending X — xotiictech.net")
            await interaction.user.send(embed=dm)
            await interaction.followup.send(
                f"**{info['name']}** sent to your DMs.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.followup.send(f"```\n{entry}\n```", ephemeral=True)

        from bot.logging import log_vend

        server_name = interaction.guild.name if interaction.guild else None
        await log_vend(
            self.bot, interaction.user, info["name"], st, "BOT",
            entry, remaining, server_name,
        )

    @app_commands.command(name="stock", description="Check stock")
    async def stocklist(self, interaction: discord.Interaction) -> None:
        embed = discord.Embed(title="Stock", color=discord.Color.dark_red())
        total = 0
        regular: list[str] = []
        premium: list[str] = []
        for st, info in STOCK_TYPES.items():
            cnt = stock.count(st)
            total += cnt
            tag = f"`{cnt}`" if cnt > 0 else "`EMPTY`"
            line = f"**{info['name']}** {tag}"
            if st.startswith("premium_"):
                premium.append(line)
            else:
                regular.append(line)
        if regular:
            embed.add_field(name="Regular", value="\n".join(regular), inline=True)
        if premium:
            embed.add_field(name="Premium", value="\n".join(premium), inline=True)
        embed.set_footer(text=f"{total} items in stock")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="mystats", description="Your stats")
    async def mystats(self, interaction: discord.Interaction) -> None:
        db = get_db()
        row = db.execute(
            "SELECT total_generated FROM users WHERE id = ?",
            (interaction.user.id,),
        ).fetchone()
        total = row[0] if row else 0

        recent = db.execute(
            "SELECT stock_type, generated_at FROM stock_usage "
            "WHERE user_id = ? ORDER BY generated_at DESC LIMIT 5",
            (interaction.user.id,),
        ).fetchall()

        embed = discord.Embed(
            title=interaction.user.display_name,
            color=discord.Color.dark_red(),
        )
        embed.add_field(name="Vends", value=str(total), inline=True)
        if recent:
            lines = [
                f"`{STOCK_TYPES.get(r[0], {}).get('name', r[0])}` — {str(r[1])[:10]}"
                for r in recent
            ]
            embed.add_field(name="Recent", value="\n".join(lines), inline=False)
        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="leaderboard", description="Top venders")
    async def leaderboard(self, interaction: discord.Interaction) -> None:
        db = get_db()
        rows = db.execute(
            "SELECT id, username, total_generated FROM users "
            "ORDER BY total_generated DESC LIMIT 10"
        ).fetchall()
        lines = []
        for i, (uid, uname, total) in enumerate(rows, 1):
            lines.append(f"`#{i}` <@{uid}> — **{total}**")
        embed = discord.Embed(
            title="Leaderboard",
            description="\n".join(lines) or "No vends yet.",
            color=discord.Color.dark_red(),
        )
        await interaction.response.send_message(embed=embed)

    # ── Admin ──

    @app_commands.command(name="addstock", description="Upload stock (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(stock_type="Stock type", file=".txt file")
    @app_commands.choices(stock_type=_type_choices())
    async def addstock(
        self,
        interaction: discord.Interaction,
        stock_type: app_commands.Choice[str],
        file: discord.Attachment,
    ) -> None:
        if (
            not interaction.user.guild_permissions.administrator
            and interaction.user.id != BOT_OWNER_ID
        ):
            await interaction.response.send_message("No permission.", ephemeral=True)
            return
        if not file.filename.endswith(".txt"):
            await interaction.response.send_message(
                "Needs to be a `.txt` file.", ephemeral=True
            )
            return

        content = (await file.read()).decode("utf-8", errors="ignore")
        entries = parser.auto_parse(stock_type.value, content)
        if not entries:
            await interaction.response.send_message(
                "Nothing parsed from that file.", ephemeral=True
            )
            return

        total = stock.add_entries(stock_type.value, entries)
        await interaction.response.send_message(
            f"**+{len(entries)}** to **{stock_type.name}** — `{total}` total",
            ephemeral=True,
        )

    @app_commands.command(name="removestock", description="Clear stock (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.choices(stock_type=_type_choices())
    async def removestock(
        self,
        interaction: discord.Interaction,
        stock_type: app_commands.Choice[str],
    ) -> None:
        if (
            not interaction.user.guild_permissions.administrator
            and interaction.user.id != BOT_OWNER_ID
        ):
            await interaction.response.send_message("No permission.", ephemeral=True)
            return
        stock.clear(stock_type.value)
        await interaction.response.send_message(
            f"Cleared **{stock_type.name}**.", ephemeral=True
        )

    @app_commands.command(name="preview", description="Preview parsed stock (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.choices(stock_type=_type_choices())
    async def parse_preview(
        self,
        interaction: discord.Interaction,
        stock_type: app_commands.Choice[str],
    ) -> None:
        if (
            not interaction.user.guild_permissions.administrator
            and interaction.user.id != BOT_OWNER_ID
        ):
            await interaction.response.send_message("No permission.", ephemeral=True)
            return

        p = stock.ensure_file(stock_type.value)
        raw = p.read_text(encoding="utf-8")
        fmt, entries = parser.preview_entries(stock_type.value, raw)

        desc = f"Format: `{fmt}` | Entries: `{len(parser.parse_entries(raw, fmt))}`\n"
        for i, e in enumerate(entries, 1):
            desc += f"\n**{i}.** ```\n{e[:300]}\n```"
        if not entries:
            desc += "\n*Empty.*"

        embed = discord.Embed(
            title=f"Preview — {stock_type.name}",
            description=desc,
            color=discord.Color.dark_red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="setformat", description="Override parse format (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.choices(stock_type=_type_choices())
    @app_commands.describe(
        format="line, blank_separated, dash_separated, numbered, pipe_fields, "
               "key_value_block, comma_fields, tab_fields, url_per_line"
    )
    async def setformat(
        self,
        interaction: discord.Interaction,
        stock_type: app_commands.Choice[str],
        format: str,
    ) -> None:
        if (
            not interaction.user.guild_permissions.administrator
            and interaction.user.id != BOT_OWNER_ID
        ):
            await interaction.response.send_message("No permission.", ephemeral=True)
            return
        if parser.set_format(stock_type.value, format):
            await interaction.response.send_message(
                f"**{stock_type.name}** format → `{format}`", ephemeral=True
            )
        else:
            await interaction.response.send_message(
                f"Invalid. Options: `{', '.join(parser.VALID_FORMATS)}`",
                ephemeral=True,
            )

    @app_commands.command(name="setlog", description="Set log channel (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def setlogchannel(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
    ) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("No permission.", ephemeral=True)
            return
        db = get_db()
        db.execute(
            "INSERT OR REPLACE INTO vending_configs (server_id, log_channel_id) "
            "VALUES (?, ?)",
            (interaction.guild.id, channel.id),
        )
        db.commit()
        await interaction.response.send_message(
            f"Logs → {channel.mention}", ephemeral=True
        )

    @app_commands.command(name="setannounce", description="Set announce channel (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def setupannounce(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        role: discord.Role = None,
    ) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("No permission.", ephemeral=True)
            return
        db = get_db()
        db.execute(
            "INSERT OR REPLACE INTO vending_configs "
            "(server_id, announce_channel_id, announce_role_id) VALUES (?, ?, ?)",
            (interaction.guild.id, channel.id, role.id if role else None),
        )
        db.commit()
        msg = f"Announcements → {channel.mention}"
        if role:
            msg += f" | Ping: {role.mention}"
        await interaction.response.send_message(msg, ephemeral=True)

    @app_commands.command(
        name="setautoupdate", description="Set auto-update channel (Admin)"
    )
    @app_commands.default_permissions(administrator=True)
    async def setautoupdate(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        role: discord.Role = None,
    ) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("No permission.", ephemeral=True)
            return
        db = get_db()
        db.execute(
            "INSERT OR REPLACE INTO vending_configs "
            "(server_id, auto_update_channel_id, auto_update_role_id) VALUES (?, ?, ?)",
            (interaction.guild.id, channel.id, role.id if role else None),
        )
        db.commit()
        msg = f"Auto-update → {channel.mention}"
        if role:
            msg += f" | Ping: {role.mention}"
        await interaction.response.send_message(msg, ephemeral=True)

    @app_commands.command(name="panel", description="Owner stats")
    async def ownerpanel(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != BOT_OWNER_ID:
            await interaction.response.send_message("Owner only.", ephemeral=True)
            return
        db = get_db()
        total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_vends = db.execute("SELECT COUNT(*) FROM stock_usage").fetchone()[0]
        total_stock = sum(stock.count(st) for st in STOCK_TYPES)

        embed = discord.Embed(title="Vending X", color=discord.Color.dark_red())
        embed.add_field(name="Servers", value=str(len(self.bot.guilds)), inline=True)
        embed.add_field(name="Users", value=str(total_users), inline=True)
        embed.add_field(name="Vends", value=str(total_vends), inline=True)
        embed.add_field(name="Stock", value=str(total_stock), inline=True)
        embed.add_field(
            name="Ping",
            value=f"{round(self.bot.latency * 1000)}ms",
            inline=True,
        )
        embed.set_footer(text="xotiictech.net/vendingx")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="link", description="Web portal login")
    async def link(self, interaction: discord.Interaction) -> None:
        token = secrets.token_urlsafe(32)
        db = get_db()
        expires = datetime.now(timezone.utc).timestamp() + 300
        db.execute(
            "INSERT INTO web_sessions "
            "(session_id, user_id, discord_username, expires_at) VALUES (?, ?, ?, ?)",
            (
                token,
                interaction.user.id,
                str(interaction.user),
                datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(),
            ),
        )
        db.commit()
        url = f"{FRONTEND_URL}/vendingx/?token={token}"
        embed = discord.Embed(
            description=f"**[Open Vending X]({url})**\nExpires in 5 min. Don't share.",
            color=discord.Color.dark_red(),
        )
        try:
            await interaction.user.send(embed=embed)
            await interaction.response.send_message(
                "Check your DMs.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(VendingCog(bot))
    log.info("VendingCog loaded")
