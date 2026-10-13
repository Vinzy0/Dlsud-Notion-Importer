# Privacy Policy — UDScraper

**Last updated: October 13, 2026**

UDScraper is a Chrome extension that helps DLSUD students sync their LMS assignments to Notion.

## What we collect

- **LMS task data** — assignment names, due dates, and links read from the DLSUD LMS and saved in Chrome's local extension storage.
- **Notion access token** — used to access your chosen Notion workspace. Saved in Chrome's local extension storage after it is returned through the Cloudflare Worker during OAuth connection.

## What we do with it

- Task data is sent to the Notion API (`api.notion.com`) when you request synchronization to your chosen database.
- During connection, the extension sends your OAuth authorization code to `udscraper.sapture.workers.dev`. The Cloudflare Worker exchanges it with Notion and returns the token to the extension. Both the code and returned token pass through the Worker.
- The checked-in `worker.js` contains no explicit code/token logging or persistent storage calls. **UNVERIFIED:** the deployed Worker's code and Cloudflare logging settings have not been audited. This statement describes the source code and is not a blanket no-logging guarantee.

## Data storage

The extension saves tasks, its Notion token and settings in Chrome's `chrome.storage.local`. Task data leaves the device for Notion synchronization. The OAuth code and returned token also pass through the Cloudflare Worker during connection.

## Permissions

- **activeTab / scripting** — to read your DLSUD dashboard and scrape task data.
- **storage** — to save tasks and your Notion token locally.
- **identity** — to handle the Notion OAuth login flow.

## Contact

If you have questions, open an issue at the project repository.
