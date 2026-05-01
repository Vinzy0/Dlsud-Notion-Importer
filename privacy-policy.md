# Privacy Policy — UDScraper

**Last updated: April 2026**

UDScraper is a Chrome extension that helps DLSUD students sync their LMS assignments to Notion.

## What we collect

- **LMS task data** — assignment names, due dates, and links scraped from your DLSUD dashboard. This data is only read while you use the extension and is stored locally on your device.
- **Notion access token** — used to write tasks to your Notion workspace. Stored locally in Chrome's extension storage on your device only.

## What we do with it

- Task data is sent to the Notion API (api.notion.com) solely to create pages in your chosen database.
- Your Notion token is exchanged securely via a Cloudflare Worker that acts as an OAuth relay. The worker does not log or store your token.
- No data is sold, shared, or sent to any third party beyond the Notion API.

## Data storage

All data (tasks, token, settings) is stored locally in Chrome's `chrome.storage.local`. It never leaves your device except when syncing to Notion at your explicit request.

## Permissions

- **activeTab / scripting** — to read your DLSUD dashboard and scrape task data.
- **storage** — to save tasks and your Notion token locally.
- **identity** — to handle the Notion OAuth login flow.

## Contact

If you have questions, open an issue at the project repository.
