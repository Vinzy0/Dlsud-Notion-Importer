<div align="center">

# UDScraper

**Sync your DLSUD assignments to Notion — in one click.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)

</div>

---

## What is this?

UDScraper is a Chrome extension for **DLSUD students** that pulls your assignments straight from the LMS and sends them to a Notion database — automatically grouped by subject, with due dates, and without any copy-pasting.

No tokens to configure. No spreadsheets to maintain. Just connect your Notion and go.

Current usage: **2 users**, as reported by the project owner.

---

## Features

- 🔐 **One-click Notion login** — OAuth flow, no manual token setup
- 🗂️ **Auto-creates your database** — a "DLSUD Tasks" database is set up in your Notion on first connect
- 📚 **Grouped by subject** — tasks are organized under collapsible subject headers by default
- 📅 **Sort options** — switch between Grouped, Due Date, or Name views
- ✅ **Send selected or sync all** — push just the tasks you want, or sync everything at once
- 🔁 **Duplicate detection** — skips task IDs recorded as synced in local extension storage
- 📥 **Download tasks** — export your scraped assignments as a local file
- 🌙 **Dark mode** — easy on the eyes during late-night cramming

---

## How it works

```
DLSUD LMS -> Extension (assignment reads)
Extension -> Cloudflare Worker -> Notion (OAuth code exchange)
Extension <- Cloudflare Worker <- Notion (token response)
Extension -> Notion API (database setup and task sync)
```

1. Open the extension on your DLSUD dashboard
2. It scrapes your assignments from the page
3. Hit **Sync All** (or select specific tasks and hit **Send to Notion**)
4. Tasks land in your Notion database, grouped and dated

The extension sends your Notion OAuth authorization code to `https://udscraper.sapture.workers.dev`. This Cloudflare Worker exchanges the code with Notion and returns the token to the extension, which saves it in Chrome's local extension storage. The code and returned token pass through the Worker.

The checked-in [Worker code](worker.js) has no explicit code/token logging or persistent storage calls. **UNVERIFIED:** the deployed Worker's code and Cloudflare logging settings have not been audited; this repository does not establish a blanket no-logging guarantee.

---

## Getting started

**UNVERIFIED:** a specific Chrome Web Store listing URL is not documented here. The previous link led to the store homepage. Use the manual installation steps below until the listing is verified.

### Load it manually (dev mode)

1. Clone this repo
   ```bash
   git clone https://github.com/Vinzy0/Dlsud-Notion-Importer.git
   ```
2. Go to `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select the project folder
4. Open the extension on your DLSUD LMS page and connect Notion

---

## Project structure

```
├── manifest.json       # Extension config (MV3)
├── popup.html          # Main UI
├── actions.js          # Event handlers & business logic
├── ui.js               # DOM rendering
├── state.js            # App state & constants
├── notion.js           # Notion API integration
├── background.js       # Service worker (OAuth flow)
├── scraper.js          # LMS scraping logic
├── logger.js           # Dev logging utility
├── offscreen.js/.html  # Offscreen DOM parser
├── worker.js           # Cloudflare Worker (OAuth relay, deployed separately)
├── styles.css          # All styles
└── icons/              # Extension icons
```

---

## Tech stack

| Layer | Tech |
|---|---|
| Extension | Chrome MV3, Vanilla JS (ES Modules) |
| Auth relay | Cloudflare Workers |
| Database | Notion API |
| Storage | `chrome.storage.local` |

---

## Privacy

The extension stores task data, settings and its Notion token in Chrome's local extension storage. Its data flows include:

- **DLSUD LMS** (`dlsud.edu20.org`) — to read assignments and files
- **Notion API** (`api.notion.com`) — for authorization, database setup and task synchronization
- **Cloudflare Worker** (`udscraper.sapture.workers.dev`) — to exchange the OAuth code with Notion and return the token

Task data is sent to Notion when you request a sync. The OAuth code and returned token pass through the Worker during connection. See the [privacy policy](privacy-policy.md) for the source-verified scope and deployment limitations.

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

---
