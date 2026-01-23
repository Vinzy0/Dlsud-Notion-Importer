// ==========================================
// DLSUD TO NOTION - FINAL BUILD
// ==========================================

// --- 1. SETTINGS & KEY MANAGEMENT ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if keys exist on load
    chrome.storage.sync.get(['notionToken', 'notionDbId'], (items) => {
        if (!items.notionToken || !items.notionDbId) {
            showSettings();
        } else {
            document.getElementById('apiKey').value = items.notionToken;
            document.getElementById('dbId').value = items.notionDbId;
        }
    });
});

document.getElementById("toggleSettings").addEventListener("click", showSettings);

document.getElementById("saveBtn").addEventListener("click", () => {
    const token = document.getElementById("apiKey").value.trim();
    const dbId = document.getElementById("dbId").value.trim();

    if (token && dbId) {
        chrome.storage.sync.set({ notionToken: token, notionDbId: dbId }, () => {
            hideSettings();
            document.getElementById("status").textContent = "Keys saved!";
        });
    }
});

function showSettings() {
    document.getElementById("main-view").classList.add("hidden");
    document.getElementById("settings-view").classList.remove("hidden");
}

function hideSettings() {
    document.getElementById("settings-view").classList.add("hidden");
    document.getElementById("main-view").classList.remove("hidden");
}


// --- 2. THE MAIN SYNC LOGIC ---
document.getElementById("syncBtn").addEventListener("click", async () => {
    const status = document.getElementById("status");
    status.textContent = "Loading keys...";

    // A. Get Keys
    chrome.storage.sync.get(['notionToken', 'notionDbId'], async (items) => {
        if (!items.notionToken || !items.notionDbId) {
            status.textContent = "Error: Configure API Keys first!";
            showSettings();
            return;
        }

        // B. Scrape the Dashboard Widget
        status.textContent = "Scanning Dashboard...";
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: scrapeWidgetLinks
        }, async (results) => {
            if (!results || !results[0] || !results[0].result) {
                status.textContent = "No To-Do widget found.";
                return;
            }

            const subjectLinks = results[0].result;
            status.textContent = `Found ${subjectLinks.length} subjects. Deep analyzing...`;

            // C. THE DEEP CRAWLER
            const finalTasks = [];

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
                            const row = td.closest("tr");

                            let finalDate = "No Due Date";

                            // If we found a "Due" header, grab that exact column
                            if (dueIndex > -1 && row.cells[dueIndex]) {
                                const rawDate = row.cells[dueIndex].innerText.trim();
                                finalDate = (rawDate === "-") ? "No Due Date" : rawDate;
                            }
                            // FALLBACK: If "Due" header doesn't exist (Lite Table), try Regex on col 2
                            else if (row.cells.length > 2) {
                                const backupDate = row.cells[2].innerText.trim();
                                if (/^[A-Z][a-z]{2}\s\d/.test(backupDate)) finalDate = backupDate;
                            }

                            // Clean up text (remove newlines/tabs)
                            finalDate = finalDate.replace(/\s+/g, " ").trim();

                            finalTasks.push({
                                subject: link.subject,
                                name: anchor.innerText.trim(),
                                date: finalDate,
                                link: "https://dlsud.edu20.org" + anchor.getAttribute("href")
                            });
                        });
                    }
                    // 3. Handle Single Assignment Redirects
                    else if (doc.querySelector("#fixedSectionHeader h2")) {
                        const title = doc.querySelector("#fixedSectionHeader h2").innerText.trim();
                        finalTasks.push({
                            subject: link.subject,
                            name: title,
                            date: "Check Link", // Date is usually hidden on single pages
                            link: link.url
                        });
                    }

                } catch (err) { console.error(err); }
            }

            // D. UPLOAD TO NOTION
            if (finalTasks.length === 0) {
                status.textContent = "No pending tasks found!";
                return;
            }

            status.textContent = `Uploading ${finalTasks.length} tasks...`;
            chrome.runtime.sendMessage({
                action: "sendToNotion",
                data: finalTasks,
                auth: { token: items.notionToken, dbId: items.notionDbId }
            }, (response) => {
                status.textContent = response.status;
            });
        });
    });
});

// --- HELPER: Scrape Dashboard Links ---
function scrapeWidgetLinks() {
    const rows = document.querySelectorAll(".user_todo_widget a.title_and_count");
    const links = [];
    rows.forEach(row => {
        let subject = row.querySelector("span:first-child")?.textContent.trim();
        let relativeLink = row.getAttribute("href");
        if (subject && relativeLink) {
            links.push({
                subject: subject,
                url: "https://dlsud.edu20.org" + relativeLink
            });
        }
    });
    return links;
}