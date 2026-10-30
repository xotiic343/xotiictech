from __future__ import annotations

import logging
import os

import discord
from discord.ui import Button, Select, View

from bot import stock, access
from bot.access import cooldowns

log = logging.getLogger("vendingx.views")

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://xotiictech.net")


def _stock_types() -> dict:
    from bot.bot import STOCK_TYPES, refresh_stock_types
    refresh_stock_types()
    return STOCK_TYPES


def build_machine_embed() -> discord.Embed:
    types = _stock_types()
    total = sum(stock.count(st) for st in types)

    embed = discord.Embed(
        title="VENDING X",
        description="Pick a product below and hit **VEND**.\n`[P]` = Premium only\nBeta items are free for everyone.",
        color=discord.Color.dark_red(),
    )

    beta: list[str] = []
    premium: list[str] = []
    for st, info in types.items():
        cnt = stock.count(st)
        tag = f"`{cnt}`" if cnt > 0 else "`--`"
        line = f"{info['name']} {tag}"
        if st.startswith("premium_"):
            premium.append(line)
        else:
            beta.append(line)

    if beta:
        embed.add_field(name="Beta Vending", value="\n".join(beta[:12]), inline=True)
    if premium:
        embed.add_field(name="Premium", value="\n".join(premium[:12]), inline=True)

    embed.set_footer(text=f"{total} items loaded — xotiictech.net/vendingx")
    return embed


def build_beta_embed() -> discord.Embed:
    types = _stock_types()
    embed = discord.Embed(
        title="BETA VENDING — LIVE STOCK",
        color=discord.Color.dark_red(),
    )
    lines: list[str] = []
    total = 0
    for st, info in types.items():
        if st.startswith("premium_"):
            continue
        cnt = stock.count(st)
        total += cnt
        filled = min(cnt, 10)
        bar = "█" * filled + "░" * (10 - filled)
        lines.append(f"`{bar}` **{info['name']}** — {cnt}")

    if lines:
        embed.add_field(name="Free Items", value="\n".join(lines), inline=False)
    embed.set_footer(text=f"{total} total — updates every 5 min")
    return embed


def build_premium_embed() -> discord.Embed:
    types = _stock_types()
    embed = discord.Embed(
        title="PREMIUM VENDING — LIVE STOCK",
        color=discord.Color.dark_red(),
    )
    lines: list[str] = []
    total = 0
    for st, info in types.items():
        if not st.startswith("premium_"):
            continue
        cnt = stock.count(st)
        total += cnt
        filled = min(cnt, 10)
        bar = "█" * filled + "░" * (10 - filled)
        lines.append(f"`{bar}` **{info['name']}** — {cnt}")

    if lines:
        embed.add_field(name="Premium Items", value="\n".join(lines), inline=False)
    embed.set_footer(text=f"{total} total — updates every 5 min")
    return embed


class VendingMachineView(View):
    def __init__(self, user_id: int, bot: discord.Client, db) -> None:
        super().__init__(timeout=None)
        self.user_id = user_id
        self.bot = bot
        self.db = db
        self.selected_slot: str | None = None
        self._build()

    def _build(self) -> None:
        self.clear_items()
        types = _stock_types()
        options: list[discord.SelectOption] = []
        for st, info in types.items():
            cnt = stock.count(st)
            prem = st.startswith("premium_")
            options.append(discord.SelectOption(
                label=f"{'[P] ' if prem else ''}{info['name']}",
                value=st,
                description=f"{info['description']} ({cnt} left)",
            ))

        if not options:
            options.append(discord.SelectOption(label="No stock loaded", value="_empty"))

        select = Select(placeholder="Pick a product...", options=options[:25])
        select.callback = self._on_select
        self.add_item(select)
        self.add_item(self.vend_button)
        self.add_item(self.refresh_button)

    async def _on_select(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "Use `/vending` to open your own.", ephemeral=True
            )
            return

        self.selected_slot = interaction.data["values"][0]
        info = _stock_types().get(self.selected_slot, {})
        cnt = stock.count(self.selected_slot)

        prem = self.selected_slot.startswith("premium_")
        tier = "Premium" if prem else "Beta Vending"
        embed = discord.Embed(
            title=info.get("name", self.selected_slot),
            description=f"Tier: **{tier}**\nStock: `{cnt}`\nHit **VEND** to get one.",
            color=discord.Color.dark_red(),
        )
        await interaction.response.edit_message(embed=embed, view=self)

    @discord.ui.button(label="VEND", style=discord.ButtonStyle.danger, row=1)
    async def vend_button(
        self, interaction: discord.Interaction, button: Button
    ) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "Use `/vending` to open your own.", ephemeral=True
            )
            return

        if not self.selected_slot or self.selected_slot == "_empty":
            await interaction.response.send_message(
                "Pick something first.", ephemeral=True
            )
            return

        is_premium = self.selected_slot.startswith("premium_")

        if is_premium and not access.has_access(self.bot, self.db, interaction.user.id):
            embed = discord.Embed(
                title="Premium Access Required",
                description=(
                    f"This is a **Premium** item. You need one of:\n"
                    f"• <@&{access.PREMIUM_ROLE_ID}> role\n"
                    f"• [$3 one-time]({FRONTEND_URL}/vendingx) on the site\n"
                    f"• Server boost\n\n"
                    f"**Beta Vending** items are free for everyone!"
                ),
                color=discord.Color.dark_red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        on_cd, remaining = cooldowns.check(interaction.user.id, "bot")
        if on_cd:
            await interaction.response.send_message(
                f"Wait `{remaining}s`.", ephemeral=True
            )
            return

        await interaction.response.defer()

        types = _stock_types()
        info = types.get(self.selected_slot, {"name": self.selected_slot})

        entry = stock.dispense(self.selected_slot)
        if not entry:
            empty = discord.Embed(
                description=f"**{info['name']}** is out of stock.",
                color=discord.Color.dark_red(),
            )
            await interaction.followup.send(embed=empty, ephemeral=True)
            self._build()
            try:
                await interaction.message.edit(
                    embed=build_machine_embed(), view=self
                )
            except discord.HTTPException:
                pass
            return

        cooldowns.set(interaction.user.id, "bot")
        left = stock.count(self.selected_slot)

        from bot.db import get_db

        db = get_db()
        db.execute(
            "INSERT OR IGNORE INTO users (id, username, total_generated) "
            "VALUES (?, ?, 0)",
            (interaction.user.id, str(interaction.user)),
        )
        db.execute(
            "INSERT INTO stock_usage "
            "(user_id, stock_type, stock_content, source, server_id) "
            "VALUES (?, ?, ?, 'BOT', ?)",
            (interaction.user.id, self.selected_slot, entry, interaction.guild_id),
        )
        db.execute(
            "UPDATE users SET total_generated = total_generated + 1 WHERE id = ?",
            (interaction.user.id,),
        )
        db.commit()

        delivered = False
        try:
            dm = discord.Embed(
                title=info["name"],
                description=f"```\n{entry}\n```",
                color=discord.Color.dark_red(),
            )
            dm.set_footer(text="Vending X — xotiictech.net")
            await interaction.user.send(embed=dm)
            delivered = True
        except discord.Forbidden:
            await interaction.followup.send(f"```\n{entry}\n```", ephemeral=True)
            delivered = True

        if not delivered:
            stock.restore(self.selected_slot, entry)

        result = discord.Embed(
            title=f"Vended — {info['name']}",
            description="Sent to your DMs." if delivered else "Delivery failed.",
            color=discord.Color.dark_red(),
        )
        result.set_footer(text=f"{left} remaining")
        await interaction.followup.send(embed=result)

        self._build()
        try:
            await interaction.message.edit(embed=build_machine_embed(), view=self)
        except discord.HTTPException:
            pass

        from bot.logging import log_vend

        server_name = interaction.guild.name if interaction.guild else None
        await log_vend(
            self.bot, interaction.user, info["name"], self.selected_slot,
            "BOT", entry, left, server_name,
        )

    @discord.ui.button(label="Refresh", style=discord.ButtonStyle.secondary, row=1)
    async def refresh_button(
        self, interaction: discord.Interaction, button: Button
    ) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "Use `/vending` to open your own.", ephemeral=True
            )
            return
        self._build()
        await interaction.response.edit_message(
            embed=build_machine_embed(), view=self
        )
