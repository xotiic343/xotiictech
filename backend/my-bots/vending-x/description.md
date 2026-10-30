## The vending machine for your Discord server

Vending X is a themed digital-inventory dispenser. Load any `.txt` file with stock entries and members vend items through slash commands, interactive buttons or the web portal. Each vend is atomic — if delivery fails the item goes back in stock. Owners get a DM log for every dispense.

## Features

- **Universal file parser:** auto-detects 8+ text layouts (one-per-line, blank-separated, dash-separated, numbered, pipe fields, key-value blocks, comma fields, tab fields, URL-per-line). Drop in any format and it just works.
- **25 stock types:** 16 regular categories and 9 premium-only categories, each backed by its own `.txt` file.
- **Atomic stock operations:** write-to-tmp + rename ensures no partial writes or corruption, even under concurrent vends.
- **Transactional dispense:** if the DM or embed fails, the entry is restored to stock automatically.
- **Three access paths:** premium role, $3 Stripe one-time payment, or server boost — any one grants access.
- **Web portal:** a hyper-realistic vending machine UI at `/vendingx` with Discord OAuth, real-time stock polling, keypad input, copy-to-clipboard and dispensing animations.
- **Owner DM logging:** rate-limited to 1 per 2 seconds with channel fallback so you never miss a vend.
- **Rate limiting:** per-user AND per-IP, 5-second cooldown on both bot and web.
- **SQLite WAL mode:** fast concurrent reads, parameterized queries only.
- **Interactive Discord UI:** dropdown stock selector, VEND button, live stock embed with auto-refresh.

## Quick setup

```
1. Add stock:       /addstock type:nitro
2. Set log channel: /setlogchannel channel:#vend-logs
3. Deploy panel:    /vending
4. Optional:        /setupannounce channel:#announcements
```

Run `/stocklist` to see counts across all types, `/ownerpanel` for admin controls.
