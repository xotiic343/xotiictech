# Changelog

All notable changes to Vending X will be documented in this file.

## [1.0.0] - 2026-10-29

### Added
- Discord bot with interactive vending machine UI (`/vending`, `/vend`)
- Universal file parser supporting 8+ text layouts (line, blank-separated, dash-separated, numbered, pipe, key-value, comma, tab, URL)
- Atomic stock file operations with write-to-tmp + os.replace
- Transactional dispense with rollback on delivery failure
- Three-path access control: premium role, $3 Stripe payment, server boost
- Web portal with hyper-realistic vending machine UI
- Discord OAuth2 login for web portal
- Stripe checkout integration with webhook signature verification
- Owner DM logging with rate-limiting (1 per 2s) and channel fallback
- Admin commands: `/addstock`, `/removestock`, `/parse-preview`, `/setformat`
- Server config: `/setlogchannel`, `/setupannounce`, `/setautoupdate`
- Owner panel: `/ownerpanel`
- One-time web login link: `/link`
- Live stock polling (15s interval) on web portal
- Keyboard-navigable slot grid with keypad input
- Vending animation: button press, machine shake, tray dispense
- Per-user AND per-IP rate limiting on web vending
- Drag-and-drop stock upload for admin
- SQLite database with WAL mode
- Full test suite for parser and access control
- Discloud deployment config
- Docker support
