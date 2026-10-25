## Keep your server safe, and get it back if the worst happens

Security X stops raids and nukes as they start, handles everyday moderation, and keeps a full backup of your server. Members who verify can be brought back automatically if you ever have to rebuild. You manage it with slash commands in Discord, and everything is logged.

## Protection

- **Anti-nuke:** watches the audit log for mass bans, kicks, prunes, and channel, role and emoji deletions. Anyone who goes over the limit has their roles removed, or is kicked or banned. Bots added by people you haven't trusted are removed instantly.
- **Anti-raid:** a sudden flood of joins triggers **raid mode**. Every channel is locked, verification goes to High, and new joins are kicked until you lift it.
- **AutoMod:** blocks invite links, links, caps, mass mentions, blocked words and spam, with automatic timeouts. Staff and whitelisted members are never touched.
- **Whitelist:** trusted members and roles are ignored by anti-nuke and AutoMod.

## Moderation

- Ban, unban, kick, timeout, warn, purge, slowmode, lock and unlock, plus a channel **nuke** that recreates a channel empty after you confirm.
- **Jail:** strips a member's roles and saves them, moves them to a jail text and voice channel (even out of a call), and restores exactly what they had on unjail. Leaving and rejoining doesn't get anyone out.
- Numbered cases and a full moderation history for every user.

## Verification and member backups

- Verify with one button, a captcha, or **website verification**.
- With website verification, members agree that Security X may add them to your backup server if this one is lost. You can then **pull your verified members** into a new server in one command, and they get their old roles back.

## Server Saver

- `/backup create` saves **the whole server**: roles, categories, channels, permissions, emojis, stickers, settings and everyone's roles.
- `/backup load` shows a preview, then restores it into any server. It never deletes anything, and it's safe to run twice.

## Logs

Moderation and alerts, joins and leaves, message edits and deletes, and **voice activity**: joins, leaves, moves, mute and deafen, screen share and camera.

## Quick setup

```
/jailsetup
/setlogs type:all channel:#security-logs
/setverify channel:#verify role:@Verified
/antinuke state:on
/antiraid state:on
```

Move the Security X role to the top of your role list so it can protect against everyone.
