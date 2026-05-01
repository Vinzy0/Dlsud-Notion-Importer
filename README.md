<div align="center">

# UDScraper

**Sync your DLSUD assignments to Notion — in one click.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-4285F4?style=flat-square&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What is this?

UDScraper is a Chrome extension for **DLSUD students** that pulls your assignments straight from the LMS and sends them to a Notion database — automatically grouped by subject, with due dates, and without any copy-pasting.

No tokens to configure. No spreadsheets to maintain. Just connect your Notion and go.

---

## Features

- 🔐 **One-click Notion login** — OAuth flow, no manual token setup
- 🗂️ **Auto-creates your database** — a "DLSUD Tasks" database is set up in your Notion on first connect
- 📚 **Grouped by subject** — tasks are organized under collapsible subject headers by default
- 📅 **Sort options** — switch between Grouped, Due Date, or Name views
- ✅ **Send selected or sync all** — push just the tasks you want, or sync everything at once
- 🔁 **Duplicate detection** — already-synced tasks are never sent twice
- 📥 **Download tasks** — export your scraped assignments as a local file
- 🌙 **Dark mode** — easy on the eyes during late-night cramming

---

## How it works

```
DLSUD LMS  ──scrape──▶  Extension  ──OAuth──▶  Cloudflare Worker  ──token──▶  Notion API
```

1. Open the extension on your DLSUD dashboard
2. It scrapes your assignments from the page
3. Hit **Sync All** (or select specific tasks and hit **Send to Notion**)
4. Tasks land in your Notion database, grouped and dated

Your Notion token is exchanged through a Cloudflare Worker — your credentials never touch a third-party server or get stored anywhere except your own device.

---

## Getting started

### Install from the Chrome Web Store

> [**Add to Chrome →**](https://chrome.google.com/webstore)

### Or load it manually (dev mode)

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

All data stays on your device. The only outbound requests are:

- **Notion API** (`api.notion.com`) — to create your task pages
- **Cloudflare Worker** — to securely exchange your OAuth code for a token (no logging, no storage)

No data is ever sold or shared. See the full [privacy policy](privacy-policy.md).

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

---
