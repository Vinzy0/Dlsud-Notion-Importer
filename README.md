# UDScraper

A Chrome extension that automatically pulls your assignments from the **DLSUD LMS** and syncs them to a **Notion database** — so you always know what's due and when.

> Built for De La Salle University Dasmarinas students.

---

## Features

- **Scan assignments** — scrapes all pending tasks from your LMS To-Do widget in one click
- **Deep scan** — follows each subject page to find every assignment and attached file
- **Notion sync** — pushes tasks directly to your Notion database (skips duplicates automatically)
- **Overdue detection** — highlights and counts overdue tasks on the extension badge
- **File detection** — finds downloadable attachments (PDFs, PPTX, DOCX, etc.) linked to your tasks
- **Dark mode** — clean UI that works in both light and dark themes

---

## Installation

> UDScraper is not on the Chrome Web Store. Install it manually in a few steps.

**1. Download the extension**

Go to the [Releases](https://github.com/Vinzy0/Dlsud-Notion-Importer/releases/latest) page and download `udscraper.zip`.

**2. Unzip it**

Extract the zip to a permanent folder on your computer (don't delete it after — Chrome loads from that folder).

**3. Load in Chrome**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder you just extracted

The UDScraper icon will appear in your extensions bar.

---

## Setup

### 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**, give it a name (e.g. "UDScraper"), and hit **Submit**
3. Copy the **Internal Integration Secret** (starts with `ntn_` or `secret_`)

### 2. Create a Notion Database

Create a new Notion database with these exact column names and types:

| Column | Type |
|---|---|
| Name | Title |
| Subject | Text |
| Due Date | Text |
| Link | URL |

### 3. Connect the integration to your database

1. Open the database in Notion
2. Click `•••` (top right) → **Connections** → find your integration and connect it

### 4. Get the Database ID

Open your database as a full page. The URL will look like:
```
https://www.notion.so/yourworkspace/YOUR-DATABASE-ID?v=...
```
Copy the 32-character ID between the last `/` and the `?`.

### 5. Configure the extension

1. Click the UDScraper icon in Chrome
2. Open **Settings** (⋮ icon)
3. Paste your **Notion Token** and **Database ID**
4. Save

---

## Usage

1. Log in to the [DLSUD LMS](https://dlsud.edu20.org)
2. Click the UDScraper icon
3. Hit **Scan** — your tasks will load from the current page
4. Hit **Deep Scan** to fetch all subject pages and find attachments (takes a moment)
5. Select the tasks you want and click **Send to Notion**

The badge on the extension icon shows your pending task count (red = overdue).

---

## Requirements

- Google Chrome (version 109 or later)
- A DLSUD student account
- A Notion account with an integration set up

---

## License

MIT
