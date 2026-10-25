# Security X: control panel, verify page and member pulls

Security X is a Discord security bot hosted on **Discloud**. It has moderation, jail, anti-raid, anti-nuke, AutoMod, verification, logs including voice, and full server backups. This website gives it:

| Where | What |
|---|---|
| `/xotiic` → **Security X** | Control panel for every server the bot is in. Admin login and 2FA as usual. |
| `/security/verify?g=<server>` | Public consent page members use to verify |
| API worker | Member pulls: adds consenting members to a backup server |

## How it fits

```
Bot (Discloud, outbound only) ─► /api/security/bot/state   every 60s: settings, jails, cases, backups, channels, roles
                              ─► /api/security/bot/logs    every 3s:  live log feed (mod, alert, join, message, voice)
                              ─► /api/security/bot/jobs    every 3s:  asks for panel actions, runs them, posts results
Member ─► /security/verify ─► Discord login (identify + guilds.join) ─► /api/security/oauth/callback
           (consent stored encrypted, then the bot gives the verified role through a job)
API scheduler (every 10s) ─► Discord: PUT /guilds/{target}/members/{user} for each consenting member (member pulls)
```

Discloud bots can't receive web requests, so the panel never calls the bot directly. Actions are queued and the bot picks them up within about 3 seconds. A panel action waits up to 25 seconds for the answer. A backup restore takes longer, so it starts in the background and its result shows up in **Logs**.

## Member pulling and consent

- **Who gets pulled:** only members who signed in on `/security/verify` and accepted the consent text are pulled. Discord shows the permission to them as "Join servers for you" (`guilds.join`).
- **Token storage:** tokens are **Fernet-encrypted** in the database, using `SECURITY_TOKEN_KEY`, or a key derived from `SECRET_KEY`. They never leave the API.
- **Withdrawing consent:** a member can remove Security X from Discord → Authorized Apps at any time. The next pull marks them as revoked. Admins can also click **revoke** in the panel.
- **Requirements:** the bot must already be in the target server and have **Create Invite** there.
- **How a pull runs:** pulls respect Discord's rate limits, can be cancelled, and resume after a restart.
- **Roles:** if you restored a backup in the target server, pulled members get their old roles back automatically.

Don't change `SECRET_KEY` (or `SECURITY_TOKEN_KEY`) after members have verified. The stored tokens can't be decrypted afterwards, and those members would have to verify again.

## Setup

### 1. Discord Developer Portal (the Security X application)

- **Bot tab:**
  - Copy the token.
  - Turn on **Server Members Intent** and **Message Content Intent**.
- **OAuth2 tab:**
  - Copy the **Client ID** and **Client Secret**.
  - Under **Redirects**, add `https://xotiictech.net/api/security/oauth/callback`, then click **Save Changes**.

### 2. Render → xotiictech-api → Environment

| Key | Value |
|---|---|
| `SECURITY_BOT_SECRET` | the same random string as in the bot's `.env` |
| `SECURITY_BOT_TOKEN` | Security X bot token (used to add members during pulls) |
| `SECURITY_CLIENT_ID` | Security X application ID |
| `SECURITY_CLIENT_SECRET` | from OAuth2 |
| `FRONTEND_URL` | must be `https://xotiictech.net`. The OAuth redirect is built from it |

The database tables are created by the normal `alembic upgrade head` on deploy (migration `0004`).

### 3. Bot `.env` (Discloud)

```
DISCORD_TOKEN=...
CLIENT_ID=...
WEBSITE_URL=https://xotiictech.net
SECURITY_BOT_SECRET=<same as Render>
```

Zip the `security-x` folder **without** `node_modules` and `data`, and upload it to Discloud as a new app. In the server, run:
- `/jailsetup`
- `/setlogs type:all channel:#logs`
- `/setverify channel:#verify role:@Verified`

### 4. Check it

Within a minute, `/xotiic` → **Security X** lists your server as **online**.
