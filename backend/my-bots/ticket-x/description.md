## Support tickets without the mess

Ticket X gives your server a complete ticket system. Members open a ticket from a panel and get a private channel. Staff claim it, set a priority and work it through to close. Every ticket ends with a styled transcript and a feedback rating. Panels keep working after restarts, and there's double-click protection, so duplicate tickets don't happen.

## Features

- **Panels:** buttons or a select menu, with as many categories as you need. Each one has its own symbol, description and Discord category folder.
- **Private ticket channels:** auto-numbered per server (`#ticket-0001-username`), with Claim, Close, Add User, Transcript and Priority controls.
- **Ticket states:** open, claimed, pending (staff replied, waiting on the user) and closed.
- **Priorities:** Low, Normal, High and Urgent. The embed colour follows the priority.
- **HTML transcripts:** styled and self-contained. Saved, posted to your transcript channel and sent to the user by DM.
- **After close:** the user gets a 1–5 star rating, an optional comment and a reopen button that works for a set window.
- **Auto-close on inactivity:** the user is warned at 75% of the timer, then the ticket closes on its own.
- **Blacklist:** block users and whole roles from opening tickets.
- **Limits:** a per-user open-ticket cap and an open cooldown.
- **Statistics:** totals, state breakdown, average first response, average resolution time, satisfaction score, top staff and category breakdown.
- **Logs:** opened, claimed, transferred, priority changes, added and removed users, renames, closes, feedback and blacklist events.

## Quick setup

```
/config set staffrole role:@Support
/config set logchannel channel:#ticket-logs
/config set transcriptchannel channel:#transcripts
/config set category type:default channel:Tickets
/config set maxtickets number:2
/config set autoclose minutes:1440
/panel create style:buttons
```

Run `/config view` at any time to check your settings, and `/help` for the full command list.
