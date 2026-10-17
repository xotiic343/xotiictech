# Discord bot auto-import & sync

Add a bot's token to one environment variable and the bot shows up on the site with its live server count and slash commands. You never enter bot details by hand.

## How it works

Every bot token can read *its own* data from Discord's REST API. For each token in `DISCORD_BOT_TOKENS`, the sync job calls:

| Endpoint | What we take |
|---|---|
| `GET /users/@me` | bot ID, username, avatar, banner |
| `GET /applications/@me` | description, tags, public-bot flag, install scopes/permissions, `approximate_guild_count` |
| `GET /users/@me/guilds` *(fallback)* | server count, paginated, used only if Discord doesn't return an approximate count |
| `GET /applications/{id}/commands` | global slash/user/message commands with their options |
| `GET /applications/{id}/guilds/{guild}/commands` *(optional)* | guild-only commands, enabled with `DISCORD_SYNC_GUILD_COMMANDS=true` for bots in ≤25 servers |

Results are **upserted by Discord bot ID**:

- **Synced fields** (username, avatar, server count, commands…) are refreshed on every run.
- **Override fields** you set in `/xotiic → Bots → edit` (display name, descriptions, tags, pricing, media, support link, featured/hidden…) are **never** touched by sync and always win on the public site.
- **New bots** land in the **Unpublished inbox** (`/xotiic → Bots → inbox`) for one-click publishing. Turn on *Auto-publish newly discovered bots* in Settings to skip the review step.
- A token that answers `401` is marked **invalid** in the Tokens tab, and its bot shows as **offline** until the token is fixed.

### When it runs

- On API startup.
- Every **45 minutes** by default (change it in `/xotiic → Settings → Discord sync`, 5–1440 min).
- Whenever you press **Sync now** in `/xotiic → Bots`.

Runs never overlap: an in-process lock plus a Postgres advisory lock guarantees that. Every run is recorded in the **Sync log** tab and the audit log. The client respects Discord's `429 retry_after` and `X-RateLimit-*` headers, and a full sync costs about 4 requests per bot.

## Adding bots

1. [Discord Developer Portal](https://discord.com/developers/applications) → your application → **Bot** → **Reset Token** → copy it.
2. Render → `xotiictech-api` → Environment → `DISCORD_BOT_TOKENS`, comma-separated with no spaces needed:

   ```
   DISCORD_BOT_TOKENS=MTE…aaa,MTI…bbb,MTM…ccc
   ```

3. Save (Render redeploys automatically). The startup sync imports the bot within a minute, or press **Sync now**.
4. Go to `/xotiic → Bots → inbox` → **Review** → add media/pricing → **Publish**.

### Required settings and scopes

- **No privileged gateway intents** are needed. Sync only uses REST endpoints the bot can call about itself.
- For a correct **Invite** button, set **Installation → Default Install Settings** in the Developer Portal: scopes `bot` + `applications.commands` and the permissions your bot needs. Sync reads these automatically. You can also override the permission integer per bot in the admin.
- Turn on **Public Bot** if you want an invite button. Private bots get no public invite link.
- To show an app description on the site, fill in **General Information → Description** (or override it in the admin).

## Rotating a token

Do this immediately if a token leaks: someone holding it has full control of that bot.

1. Developer Portal → Bot → **Reset Token**. The old token stops working instantly.
2. Replace it in `DISCORD_BOT_TOKENS` on Render and save.
3. Press **Sync now**. The Tokens tab shows the new token as **healthy**, and the old fingerprint changes to **removed**.

The bot record, overrides, media and published state are all kept, because they're keyed by the bot's Discord ID, not the token.

## Token security

- Tokens exist **only** in the API service's environment. They aren't stored in the database (only a sha256 fingerprint and a `…last4` hint), aren't returned by any endpoint, and never reach the browser.
- A logging filter redacts every configured token from log output.
- The admin Tokens tab shows health only: `healthy`, `invalid`, `error` or `removed`.

## Removing a bot

Remove its token from `DISCORD_BOT_TOKENS`. On the next sync the bot goes **offline** and its token shows as **removed**. Unpublish or delete it in the admin to hide it. If you delete a bot whose token is still configured, the next sync re-imports it as unpublished.

## Future enhancement: a dedicated sync bot

What each bot token can see about itself is limited. Server *count* works, but member counts of your support servers and real-time online presence don't. For those, add one extra "sync bot" with the **Server Members** intent that sits in all your support servers and holds a gateway connection. Today, **online** means "the token authenticated successfully during the last sync".
