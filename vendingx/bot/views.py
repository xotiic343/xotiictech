"""Discord UI components for the vending machine.

Contains the interactive View with a dropdown selector, VEND button,
and refresh button — all themed to look like a vending machine.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

import discord
from discord.ui import Button, Select, View

from bot import stock, access
from bot.access import cooldowns

if TYPE_CHECKING:
    from bot.bot import STOCK_TYPES

log = logging.getLogger("vendingx.views")


def _stock_types() -> dict:
    """Import STOCK_TYPES at call time to avoid circular imports."""
    from bot.bot import STOCK_TYPES
    return STOCK_TYPES


def build_machine_embed() -> discord.Embed:
    """Build the main vending-machine embed with live stock counts."""
    types = _stock_types()
    total = sum(stock.count(st) for st in types)

    embed = discord.Embed(
        title="\U0001f3b0 VENDING X",
        description=(
            "```\n"
            "╔══════════════════════════════════════╗\n"
            "║     🎰  WELCOME TO VENDING X  🎰    ║\n"
            "║                                      ║\n"
            "║   Select a product from the dropdown  ║\n"
            "║   and press VEND to dispense.         ║\n"
            "║                                      ║\n"
            "║        ✨ Premium items available ✨  ║\n"
            "╚══════════════════════════════════════╝\n"
            "```"
        ),
        color=discord.Color.from_rgb(0, 229, 255),
    )

    regular: list[str] = []
    premium: list[str] = []
    for st, info in types.items():
        cnt = stock.count(st)
        led = "🟢" if cnt > 0 else ("🟡" if cnt == 0 else "🔴")
        line = f"{info['emoji']} **{info['name']}** — {led} `{cnt}`"
        if st.startswith("premium_"):
            premium.append(line)
        else:
            regular.append(line)

    if regular:
        embed.add_field(name="📦 Regular Stock", value="\n".join(regular[:10]), inline=True)
    if premium:
        embed.add_field(name="✨ Premium Stock", value="\n".join(premium[:10]), inline=True)

    embed.add_field(
        name="🎰 How to Vend",
        value="1️⃣ Select a product\n2️⃣ Press **VEND**\n3️⃣ Check your DMs 📬",
        inline=False,
    )
    embed.set_footer(text=f"Total items: {total} | Premium access required")
    return embed


class VendingMachineView(View):
    """Interactive vending machine with dropdown + VEND button."""

    def __init__(self, user_id: int, bot: discord.Client, db) -> None:
        super().__init__(timeout=300)
        self.user_id = user_id
        self.bot = bot
        self.db = db
        self.selected_slot: str | None = None
        self._add_select()

    def _add_select(self) -> None:
        """Build the product-selection dropdown."""
        types = _stock_types()
        options: list[discord.SelectOption] = []
        for st, info in types.items():
            cnt = stock.count(st)
            status = "🟢" if cnt > 0 else "🔴"
            is_prem = st.startswith("premium_")
            tag = " ✨" if is_prem else ""
            options.append(
                discord.SelectOption(
                    label=f"{info['name']}{tag}",
                    value=st,
                    description=f"{info['description']} ({cnt} left)",
                    emoji="✨" if is_prem else info["emoji"],
                )
            )

        select = Select(
            placeholder="🛒 Select a product to vend…",
            options=options[:25],
            custom_id="vx_select",
        )
        select.callback = self._on_select
        self.add_item(select)

    async def _on_select(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ Not your machine!", ephemeral=True)
            return

        self.selected_slot = interaction.values[0]
        info = _stock_types().get(self.selected_slot, {})
        cnt = stock.count(self.selected_slot)

        embed = discord.Embed(
            title=f"🛒 Selected: {info.get('emoji', '📦')} {info.get('name', self.selected_slot)}",
            description=f"**Stock:** `{cnt}`\n\nPress **VEND** below to dispense.",
            color=discord.Color.green(),
        )
        await interaction.response.edit_message(embed=embed, view=self)

    @discord.ui.button(label="VEND", style=discord.ButtonStyle.success, emoji="🎰", row=1)
    async def vend_button(self, interaction: discord.Interaction, button: Button) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ Not your machine!", ephemeral=True)
            return

        if not self.selected_slot:
            await interaction.response.send_message("❌ Select a product first!", ephemeral=True)
            return

        if not access.has_access(self.bot, self.db, interaction.user.id):
            embed = discord.Embed(
                title="🔒 Access Required",
                description=(
                    f"You need one of:\n"
                    f"• <@&{access.PREMIUM_ROLE_ID}> role\n"
                    f"• $3 one-time purchase on the website\n"
                    f"• Active server boost"
                ),
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        on_cd, remaining = cooldowns.check(interaction.user.id, "bot")
        if on_cd:
            await interaction.response.send_message(f"⏳ Wait `{remaining}s`", ephemeral=True)
            return

        await interaction.response.defer()

        types = _stock_types()
        info = types.get(self.selected_slot, {"name": self.selected_slot, "emoji": "📦", "color": 0x95A5A6})

        # Dispensing animation
        anim = discord.Embed(title="🎰 Vending…", description="```\n   📦 ➡️ 🎁   \n```", color=discord.Color.yellow())
        msg = await interaction.followup.send(embed=anim)
        await asyncio.sleep(0.8)

        entry = stock.dispense(self.selected_slot)
        if not entry:
            fail = discord.Embed(title="❌ Out of Stock!", description=f"**{info['name']}** is empty.", color=discord.Color.red())
            await msg.edit(embed=fail)
            return

        cooldowns.set(interaction.user.id, "bot")
        remaining_count = stock.count(self.selected_slot)

        # Log to DB
        from bot.db import get_db
        db = get_db()
        db.execute(
            "INSERT OR IGNORE INTO users (id, username, total_generated) VALUES (?, ?, 0)",
            (interaction.user.id, str(interaction.user)),
        )
        db.execute(
            "INSERT INTO stock_usage (user_id, stock_type, stock_content, source, server_id) "
            "VALUES (?, ?, ?, 'BOT', ?)",
            (interaction.user.id, self.selected_slot, entry, interaction.guild_id),
        )
        db.execute("UPDATE users SET total_generated = total_generated + 1 WHERE id = ?", (interaction.user.id,))
        db.commit()

        # Try DM delivery
        success = discord.Embed(
            title=f"🎉 Vended: {info['emoji']} {info['name']}",
            description=f"```\n   🎰 SUCCESSFUL VEND!   \n```\n**Remaining:** `{remaining_count}`",
            color=discord.Color.green(),
        )

        delivered = False
        try:
            dm_embed = discord.Embed(title=f"🎁 {info['name']}", description=f"```\n{entry}\n```", color=discord.Color.green())
            dm_embed.set_footer(text="From Vending X")
            await interaction.user.send(embed=dm_embed)
            success.add_field(name="📬 Delivery", value="Sent to your DMs!", inline=False)
            delivered = True
        except discord.Forbidden:
            success.add_field(name="⚠️ DM Failed", value="Enable DMs! Item sent below.", inline=False)
            await interaction.followup.send(f"```\n{entry}\n```", ephemeral=True)
            delivered = True

        if not delivered:
            stock.restore(self.selected_slot, entry)

        await msg.edit(embed=success)

        # Owner DM log
        from bot.logging import log_vend
        server_name = interaction.guild.name if interaction.guild else None
        await log_vend(self.bot, interaction.user, info["name"], self.selected_slot, "BOT", entry, remaining_count, server_name)

        self._refresh_items()

    @discord.ui.button(label="Refresh", style=discord.ButtonStyle.secondary, emoji="🔄", row=1)
    async def refresh_button(self, interaction: discord.Interaction, button: Button) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ Not your machine!", ephemeral=True)
            return
        self._refresh_items()
        await interaction.response.edit_message(embed=build_machine_embed(), view=self)

    def _refresh_items(self) -> None:
        """Rebuild the dropdown with fresh stock counts."""
        self.clear_items()
        self._add_select()
        self.add_item(self.vend_button)
        self.add_item(self.refresh_button)
