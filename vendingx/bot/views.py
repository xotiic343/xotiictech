from __future__ import annotations

import logging
import os

import discord
from discord.ui import Button, Select, View

from bot import stock, access
from bot.access import cooldowns

log = logging.getLogger("vendingx.views")

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://xotiictech.net")

STOCK_EMOJI: dict[str, str] = {
    "epic": "⚡", "steam": "🎮", "roblox": "🕹️",
    "instagram": "📸", "onlyfans": "💕", "random": "🎲",
    "randomip": "🌐", "ip": "🌐", "ubisoft": "🎯",
    "nitro": "💎", "netflix": "🎥", "spotify": "🎵",
    "minecraft": "⛏️", "r6": "🛡️",
}


def _emoji(key: str) -> str:
    for k, e in STOCK_EMOJI.items():
        if k in key:
            return e
    return "📦"


def _bar(count: int, width: int = 10) -> str:
    filled = min(count, width)
    return "▰" * filled + "▱" * (width - filled)


def _stock_types() -> dict:
    from bot.bot import STOCK_TYPES, refresh_stock_types
    refresh_stock_types()
    return STOCK_TYPES


def build_machine_embed() -> discord.Embed:
    types = _stock_types()
    total = sum(stock.count(st) for st in types)

    embed = discord.Embed(
        title="🔴  V E N D I N G   X",
        description=(
            "```\n"
            "╔════════════════════════╗\n"
            "║  SELECT • VEND • ENJOY  ║\n"
            "╚════════════════════════╝\n"
            "```\n"
            "Pick a product below and hit **VEND**.\n"
            "🟢 Beta items are **free** for everyone\n"
            "🔴 Premium items require access"
        ),
        color=0x8B0000,
    )

    beta: list[str] = []
    premium: list[str] = []
    for st, info in types.items():
        cnt = stock.count(st)
        e = _emoji(st)
        if cnt > 0:
            line = f"{e} **{info['name']}** {_bar(cnt)} `{cnt}`"
        else:
            line = f"{e} ~~{info['name']}~~ `EMPTY`"
        if st.startswith("premium_"):
            premium.append(line)
        else:
            beta.append(line)

    if beta:
        embed.add_field(
            name="🟢  Beta Vending — FREE",
            value="\n".join(beta[:12]),
            inline=False,
        )
    if premium:
        embed.add_field(
            name="🔴  Premium",
            value="\n".join(premium[:12]),
            inline=False,
        )

    embed.set_footer(
        text=f"◼ {total} items loaded  │  xotiictech.net/vendingx",
    )
    return embed


def build_beta_embed() -> discord.Embed:
    types = _stock_types()
    embed = discord.Embed(
        title="🟢  BETA VENDING — LIVE STOCK",
        description=(
            "> Free items for everyone. Use `/vend` to grab one.\n"
            "───────────────────────────────────"
        ),
        color=0x2D7D46,
    )
    lines: list[str] = []
    total = 0
    for st, info in types.items():
        if st.startswith("premium_"):
            continue
        cnt = stock.count(st)
        total += cnt
        e = _emoji(st)
        if cnt > 0:
            lines.append(f"{e} **{info['name']}**\n {_bar(cnt)} — `{cnt}` in stock")
        else:
            lines.append(f"{e} ~~{info['name']}~~ — `EMPTY`")

    if lines:
        embed.add_field(name="​", value="\n".join(lines), inline=False)
    else:
        embed.add_field(name="​", value="*No free items loaded.*", inline=False)

    embed.set_footer(text=f"◼ {total} items  │  Updates every 5 min  │  Vending X")
    return embed


def build_premium_embed() -> discord.Embed:
    types = _stock_types()
    embed = discord.Embed(
        title="🔴  PREMIUM VENDING — LIVE STOCK",
        description=(
            "> Exclusive items for premium members.\n"
            "> Get access: `$3` at [xotiictech.net/vendingx](" + FRONTEND_URL + "/vendingx)\n"
            "───────────────────────────────────"
        ),
        color=0x8B0000,
    )
    lines: list[str] = []
    total = 0
    for st, info in types.items():
        if not st.startswith("premium_"):
            continue
        cnt = stock.count(st)
        total += cnt
        e = _emoji(st)
        if cnt > 0:
            lines.append(f"{e} **{info['name']}**\n {_bar(cnt)} — `{cnt}` in stock")
        else:
            lines.append(f"{e} ~~{info['name']}~~ — `EMPTY`")

    if lines:
        embed.add_field(name="​", value="\n".join(lines), inline=False)
    else:
        embed.add_field(name="​", value="*No premium items loaded.*", inline=False)

    embed.set_footer(text=f"◼ {total} items  │  Updates every 5 min  │  Vending X")
    return embed


def _tier_embed(tier: str) -> discord.Embed:
    if tier == "premium":
        return build_premium_embed()
    return build_beta_embed()


def _tier_options(tier: str) -> list[discord.SelectOption]:
    types = _stock_types()
    options: list[discord.SelectOption] = []
    for st, info in types.items():
        is_prem = st.startswith("premium_")
        if tier == "premium" and not is_prem:
            continue
        if tier == "beta" and is_prem:
            continue
        cnt = stock.count(st)
        options.append(discord.SelectOption(
            label=info["name"],
            value=st,
            description=f"{info['description']} ({cnt} left)",
        ))
    if not options:
        options.append(discord.SelectOption(label="No stock loaded", value="_empty"))
    return options[:25]


class TierVendingView(View):
    """Persistent vending panel for a single tier (beta or premium)."""

    def __init__(self, tier: str) -> None:
        super().__init__(timeout=None)
        self.tier = tier
        self._build()

    def _build(self) -> None:
        self.clear_items()
        select = Select(
            placeholder=f"Pick a {'premium' if self.tier == 'premium' else 'free'} item...",
            options=_tier_options(self.tier),
            custom_id=f"vx:{self.tier}:select",
        )
        select.callback = self._on_select
        self.add_item(select)
        self.add_item(VendButton(self.tier))
        self.add_item(RefreshButton(self.tier))

    async def _on_select(self, interaction: discord.Interaction) -> None:
        chosen = interaction.data["values"][0]
        if chosen == "_empty":
            await interaction.response.send_message("No stock loaded.", ephemeral=True)
            return

        info = _stock_types().get(chosen, {})
        cnt = stock.count(chosen)
        e = _emoji(chosen)
        tier_label = "Premium" if self.tier == "premium" else "Beta"
        tier_dot = "🔴" if self.tier == "premium" else "🟢"
        embed = discord.Embed(
            title=f"{e}  {info.get('name', chosen)}",
            description=(
                f"```\n"
                f"  Tier  : {tier_label}\n"
                f"  Stock : {cnt}\n"
                f"```\n"
                f"{tier_dot} Hit **VEND** below to dispense."
            ),
            color=0x8B0000 if self.tier == "premium" else 0x2D7D46,
        )
        embed.set_footer(text="Vending X  │  Item expires in 2 min")
        # Store selection in the message for the VEND button
        await interaction.response.send_message(
            embed=embed,
            ephemeral=True,
            view=PersonalVendView(interaction.user.id, chosen, self.tier),
        )


class PersonalVendView(View):
    """Ephemeral view shown after selecting an item — lets the user vend."""

    def __init__(self, user_id: int, selected: str, tier: str) -> None:
        super().__init__(timeout=120)
        self.user_id = user_id
        self.selected = selected
        self.tier = tier

    @discord.ui.button(label="VEND", style=discord.ButtonStyle.danger)
    async def vend_button(self, interaction: discord.Interaction, button: Button) -> None:
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("Not your panel.", ephemeral=True)
            return

        if not self.selected or self.selected == "_empty":
            await interaction.response.send_message("Pick something first.", ephemeral=True)
            return

        is_premium = self.selected.startswith("premium_")

        from bot.db import get_db
        db = get_db()

        if is_premium and not access.has_access(interaction.client, db, interaction.user.id):
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
            await interaction.response.send_message(f"Wait `{remaining}s`.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        types = _stock_types()
        info = types.get(self.selected, {"name": self.selected})

        entry = stock.dispense(self.selected)
        if not entry:
            await interaction.followup.send(
                f"**{info['name']}** is out of stock.", ephemeral=True
            )
            return

        cooldowns.set(interaction.user.id, "bot")
        left = stock.count(self.selected)

        db.execute(
            "INSERT OR IGNORE INTO users (id, username, total_generated) VALUES (?, ?, 0)",
            (interaction.user.id, str(interaction.user)),
        )
        db.execute(
            "INSERT INTO stock_usage (user_id, stock_type, stock_content, source, server_id) "
            "VALUES (?, ?, ?, 'BOT', ?)",
            (interaction.user.id, self.selected, entry, interaction.guild_id),
        )
        db.execute(
            "UPDATE users SET total_generated = total_generated + 1 WHERE id = ?",
            (interaction.user.id,),
        )
        db.commit()

        try:
            e = _emoji(self.selected)
            dm = discord.Embed(
                title=f"{e}  {info['name']}  —  DISPENSED",
                description=(
                    f"```\n{entry}\n```\n"
                    f"───────────────────────────────────\n"
                    f"📦 `{left}` remaining in stock"
                ),
                color=0x8B0000,
            )
            dm.set_footer(text="🔴 Vending X  │  xotiictech.net/vendingx")
            await interaction.user.send(embed=dm)
            await interaction.followup.send(
                f"✅ **{info['name']}** sent to your DMs. `{left}` remaining.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.followup.send(f"```\n{entry}\n```", ephemeral=True)

        from bot.logging import log_vend
        server_name = interaction.guild.name if interaction.guild else None
        await log_vend(
            interaction.client, interaction.user, info["name"], self.selected,
            "BOT", entry, left, server_name,
        )


class VendButton(Button):
    def __init__(self, tier: str) -> None:
        super().__init__(
            label="VEND",
            style=discord.ButtonStyle.danger,
            custom_id=f"vx:{tier}:vend",
            row=1,
        )
        self.tier = tier

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message(
            "Pick an item from the dropdown first, then use the VEND button on the selection.",
            ephemeral=True,
        )


class RefreshButton(Button):
    def __init__(self, tier: str) -> None:
        super().__init__(
            label="Refresh",
            style=discord.ButtonStyle.secondary,
            custom_id=f"vx:{tier}:refresh",
            row=1,
        )
        self.tier = tier

    async def callback(self, interaction: discord.Interaction) -> None:
        embed = _tier_embed(self.tier)
        view = TierVendingView(self.tier)
        await interaction.response.edit_message(embed=embed, view=view)


# Legacy combined view (kept for /vending without tier argument)
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

        await interaction.response.defer(ephemeral=True)

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

        try:
            e = _emoji(self.selected_slot)
            dm = discord.Embed(
                title=f"{e}  {info['name']}  —  DISPENSED",
                description=(
                    f"```\n{entry}\n```\n"
                    f"───────────────────────────────────\n"
                    f"📦 `{left}` remaining in stock"
                ),
                color=0x8B0000,
            )
            dm.set_footer(text="🔴 Vending X  │  xotiictech.net/vendingx")
            await interaction.user.send(embed=dm)
            await interaction.followup.send(
                f"✅ **{info['name']}** sent to your DMs. `{left}` remaining.", ephemeral=True
            )
        except discord.Forbidden:
            await interaction.followup.send(f"```\n{entry}\n```", ephemeral=True)

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
