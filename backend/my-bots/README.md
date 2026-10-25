# my-bots

One folder per bot. The site applies these details on every Discord sync (every ~45 minutes and when the API starts), so bot pages show accurate info instead of the one-line description Discord stores.

Commands are **not** written here. They're synced live from Discord, subcommands included.

## Add a new bot

1. Copy `_template/` and rename the copy, for example `my-new-bot/`.
2. In `bot.json`, set `application_id` to the bot's **Application ID** (Developer Portal → your app → General Information). Fill in whatever else you want.
3. Write the long description in `description.md` (Markdown). Add `changelog.md` if you want a changelog section.
4. Push to GitHub. After the deploy, the next sync applies it. To apply it right away, run a sync from `/xotiic` → Bots.

The bot's token must also be in the API's `DISCORD_BOT_TOKENS`. That's what makes the bot appear on the site at all.

## bot.json fields

| Field | Example | Notes |
|---|---|---|
| `application_id` | `"1361964514693877760"` | required (or `discord_id`, the bot's user ID) |
| `name` | `"Ticket X"` | shown instead of the Discord username |
| `short_description` | `"Ticket bot with ..."` | card + header text, max 300 characters |
| `tags` | `["tickets", "support"]` | up to 12 |
| `category` | `"Support"` | |
| `pricing_type` | `"free"` | `free`, `premium` or `custom` |
| `price_label` | `"$5 / month"` | optional text shown instead of the pricing type |
| `support_url`, `website_url` | `"https://discord.gg/..."` | buttons in the sidebar |
| `version` | `"1.2.0"` | |
| `featured` | `true` | pin to the featured row |

- **Leave fields out you don't use.** A field missing from `bot.json` is never touched, so you can still edit it in `/xotiic`.
- **Fields you set here win** over `/xotiic` on the next sync.
- **Mistakes are safe.** A typo in a field name or invalid JSON is logged in the API logs, and that bot is skipped. The sync keeps running.
- **Ignored folders:** anything starting with `_` (like `_template`).
