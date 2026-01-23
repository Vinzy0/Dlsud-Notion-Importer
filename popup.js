// ==========================================
// DLSUD TO NOTION - FINAL BUILD
// ==========================================

// ==========================================
// CONSTANTS
// ==========================================
const BASE_URL = "https://dlsud.edu20.org";

// ==========================================
// 1. VALIDATION FUNCTIONS
// ==========================================

/**
 * Validates the Notion API token format.
 * Valid tokens start with 'secret_' or 'ntn_' followed by alphanumeric characters.
 * @param {string} token - The token to validate
 * @returns {boolean} True if valid format, false otherwise
 */
function isValidToken(token) {
    return /^(secret_|ntn_)[a-zA-Z0-9_-]+$/.test(token);
}

/**
 * Validates the Notion database ID format.
 * Valid IDs are 32 hexadecimal characters (with or without hyphens).
 * @param {string} dbId - The database ID to validate
 * @returns {boolean} True if valid format, false otherwise
 */
function isValidDbId(dbId) {
    const normalized = dbId.replace(/-/g, '');
    return /^[a-f0-9]{32}$/i.test(normalized);
}

// ==========================================
// 2. SETTINGS & KEY MANAGEMENT
// ==========================================

/**
 * Shows the settings configuration panel and hides the main view.
 */
function showSettings() {
    document.getElementById("main-view").classList.add("hidden");
    document.getElementById("settings-view").classList.remove("hidden");
}

/**
 * Hides the settings configuration panel and shows the main view.
 */
function hideSettings() {
    document.getElementById("settings-view").classList.add("hidden");
    document.getElementById("main-view").classList.remove("hidden");
}

/**
 * Resets the sync button to its default enabled state.
 */
function resetSyncButton() {
    const syncBtn = document.getElementById("syncBtn");
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync Tasks";
}

/**
 * Sets the sync button to a loading/disabled state.
 */
function setSyncButtonLoading() {
    const syncBtn = document.getElementById("syncBtn");
    syncBtn.disabled = true;
    syncBtn.textContent = "Syncing...";
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if keys exist on load (using local storage for security)
    chrome.storage.local.get(['notionToken', 'notionDbId'], (items) => {
        if (!items.notionToken || !items.notionDbId) {
            showSettings();
        } else {
            document.getElementById('apiKey').value = items.notionToken;
            document.getElementById('dbId').value = items.notionDbId;
        }
    });
});

// --- Settings Toggle Button ---
document.getElementById("toggleSettings").addEventListener("click", showSettings);

// --- Save Button with Validation ---
document.getElementById("saveBtn").addEventListener("click", () => {
    const token = document.getElementById("apiKey").value.trim();
    const dbId = document.getElementById("dbId").value.trim();
    const status = document.getElementById("status");

    // Validate token format
    if (!isValidToken(token)) {
        status.textContent = "Invalid token. Should start with 'secret_' or 'ntn_'";
        return;
    }

    // Validate database ID format
    if (!isValidDbId(dbId)) {
        status.textContent = "Invalid database ID. Should be 32 hex characters.";
        return;
    }

    // Store in local storage (more secure than sync)
    chrome.storage.local.set({ notionToken: token, notionDbId: dbId }, () => {
        hideSettings();
        status.textContent = "Keys saved!";
    });
});

// ==========================================
// 3. THE MAIN SYNC LOGIC
// ==========================================

document.getElementById("syncBtn").addEventListener("click", async () => {
    const status = document.getElementById("status");
    setSyncButtonLoading();
    status.textContent = "Loading keys...";

    // A. Get Keys from Local Storage
    chrome.storage.local.get(['notionToken', 'notionDbId'], async (items) => {
        if (!items.notionToken || !items.notionDbId) {
            status.textContent = "Error: Configure API Keys first!";
            showSettings();
            resetSyncButton();
            return;
        }

        // B. Scrape the Dashboard Widget
        status.textContent = "Scanning Dashboard...";
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: scrapeWidgetLinks
        }, async (results) => {
            // Handle scripting errors (e.g., wrong page, permissions)
            if (chrome.runtime.lastError) {
                console.error("Scripting Error:", chrome.runtime.lastError);
                status.textContent = "Cannot run on this page. Open DLSUD Dashboard.";
                resetSyncButton();
                return;
            }

            if (!results || !results[0] || !results[0].result) {
                status.textContent = "No To-Do widget found.";
                resetSyncButton();
                return;
            }

            const subjectLinks = results[0].result;
            status.textContent = `Found ${subjectLinks.length} subjects. Deep analyzing...`;

            // C. THE DEEP CRAWLER
            const finalTasks = [];
            const failedSubjects = [];

            for (const link of subjectLinks) {
                status.textContent = `Checking ${link.subject}...`;

                try {
                    // Fetch the page content in the background
                    const response = await fetch(link.url);
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, "text/html");

                    // --- STRATEGY: HEADER MAPPING ---
                    // 1. Find the table and figure out which column index is "Due"
                    const table = doc.querySelector("table.table-bordered");
                    let dueIndex = -1;

                    if (table) {
                        const headers = table.querySelectorAll("thead th");
                        let colCounter = 0;

                        for (let th of headers) {
                            const headerText = th.innerText.trim();
                            // If we find "Due", save the index
                            if (headerText === "Due") {
                                dueIndex = colCounter;
                                break;
                            }
                            // Add colspan to counter (e.g., 'Assessment' spans 2 cols)
                            const span = parseInt(th.getAttribute("colspan") || "1");
                            colCounter += span;
                        }
                    }

                    // 2. Scrape the Rows using the Map
                    const listRows = doc.querySelectorAll("td.assignment");

                    if (listRows.length > 0) {
                        listRows.forEach(td => {
                            const anchor = td.querySelector("a");

                            // Null check: skip rows without valid anchor elements
                            if (!anchor) {
                                return;
                            }

                            const row = td.closest("tr");

                            // Null check: skip if row not found
                            if (!row) {
                                return;
                            }

                            let finalDate = "No Due Date";

                            // If we found a "Due" header, grab that exact column
                            if (dueIndex > -1 && row.cells[dueIndex]) {
                                const rawDate = row.cells[dueIndex].innerText.trim();
                                finalDate = (rawDate === "-") ? "No Due Date" : rawDate;
                            }
                            // FALLBACK: If "Due" header doesn't exist (Lite Table), try Regex on col 2
                            // Regex matches date format like "Jan 15" (3-letter month + space + day number)
                            else if (row.cells.length > 2) {
                                const backupDate = row.cells[2].innerText.trim();
                                if (/^[A-Z][a-z]{2}\s\d/.test(backupDate)) {
                                    finalDate = backupDate;
                                }
                            }

                            // Clean up text (remove newlines/tabs)
                            finalDate = finalDate.replace(/\s+/g, " ").trim();

                            finalTasks.push({
                                subject: link.subject,
                                name: anchor.innerText.trim(),
                                date: finalDate,
                                link: BASE_URL + anchor.getAttribute("href")
                            });
                        });
                    }
                    // 3. Handle Single Assignment Redirects
                    else {
                        const titleEl = doc.querySelector("#fixedSectionHeader h2");

                        // Null check: only add if title element exists
                        if (titleEl) {
                            const title = titleEl.innerText.trim();
                            finalTasks.push({
                                subject: link.subject,
                                name: title,
                                date: "Check Link", // Date is usually hidden on single pages
                                link: link.url
                            });
                        }
                    }

                } catch (err) {
                    console.error(`Error processing ${link.subject}:`, err);
                    failedSubjects.push(link.subject);
                }
            }

            // D. UPLOAD TO NOTION
            if (finalTasks.length === 0) {
                let msg = "No pending tasks found!";
                if (failedSubjects.length > 0) {
                    msg += ` (${failedSubjects.length} subjects failed to load)`;
                }
                status.textContent = msg;
                resetSyncButton();
                return;
            }

            status.textContent = `Uploading ${finalTasks.length} tasks...`;
            chrome.runtime.sendMessage({
                action: "sendToNotion",
                data: finalTasks,
                auth: { token: items.notionToken, dbId: items.notionDbId }
            }, (response) => {
                let statusMsg = response.status;
                if (failedSubjects.length > 0) {
                    statusMsg += ` (${failedSubjects.length} subjects couldn't be crawled)`;
                }
                status.textContent = statusMsg;
                resetSyncButton();
            });
        });
    });
});

// ==========================================
// 4. HELPER: Scrape Dashboard Links
// ==========================================

/**
 * Scrapes subject links from the DLSUD dashboard To-Do widget.
 * This function is injected into the page context via chrome.scripting.
 * @returns {Array<{subject: string, url: string}>} Array of subject objects with name and URL
 */
function scrapeWidgetLinks() {
    const rows = document.querySelectorAll(".user_todo_widget a.title_and_count");
    const links = [];

    rows.forEach(row => {
        const subjectSpan = row.querySelector("span:first-child");
        const subject = subjectSpan?.textContent?.trim();
        const relativeLink = row.getAttribute("href");

        if (subject && relativeLink) {
            links.push({
                subject: subject,
                url: "https://dlsud.edu20.org" + relativeLink
            });
        }
    });

    return links;
}