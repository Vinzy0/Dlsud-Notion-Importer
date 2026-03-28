importScripts('logger.js');
importScripts('scraper.js');

/**
 * Listens for messages from the popup to send tasks to Notion or update badge.
 * @param {Object} request - The message request object
 * @param {string} request.action - The action type ('sendToNotion' or 'updateBadge')
 * @param {Array} request.tasks - Array of task objects to upload (for 'sendToNotion')
 * @param {string} request.token - Notion API bearer token (for 'sendToNotion')
 * @param {string} request.dbId - Target Notion database ID (for 'sendToNotion')
 * @param {number} request.count - Badge count (for 'updateBadge')
 * @param {boolean} request.hasOverdue - Whether there are overdue tasks (for 'updateBadge')
 * @param {Object} sender - Message sender information
 * @param {Function} sendResponse - Callback to send response back
 * @returns {boolean} True to indicate async response
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendToNotion") {
        pushToNotion(request.tasks, request.token, request.dbId).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (request.action === "updateBadge") {
        updateBadge(request.count, request.hasOverdue);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === "doDeepScan") {
        // Fire-and-forget: popup does not wait for this response.
        // Results are written to chrome.storage.local when done.
        runDeepScan(request.subjectLinks);
        sendResponse({ started: true });
        return true;
    }
});

/**
 * Fetches and parses every subject page and its task pages for files.
 * Runs entirely in the background service worker so the popup can be closed
 * mid-scan without losing progress. Results are persisted to chrome.storage.local.
 *
 * @param {Array<{subject: string, url: string}>} subjectLinks
 */
async function runDeepScan(subjectLinks) {
    const parser = new DOMParser();
    const allTasks = [];
    const allFiles = [];

    for (let i = 0; i < subjectLinks.length; i++) {
        const link = subjectLinks[i];
        try {
            chrome.runtime.sendMessage({
                action: 'scanProgress',
                current: i + 1,
                total: subjectLinks.length,
                subject: link.subject,
            }).catch(() => {});

            const response = await fetch(link.url);
            const text = await response.text();
            const doc = parser.parseFromString(text, 'text/html');

            const tasks = parseSubjectPage(doc, cleanSubject(link.subject), link.url);
            allTasks.push(...tasks);

            const taskPageResults = await Promise.all(
                tasks
                    .filter(task => task.link && task.link !== link.url)
                    .map(task =>
                        fetch(task.link)
                            .then(r => r.text())
                            .then(html => {
                                const taskDoc = parser.parseFromString(html, 'text/html');
                                return findFilesOnPage(taskDoc, task.subject, task.name, task.link);
                            })
                            .catch(e => {
                                Logger.error(`Error scanning task "${task.name}":`, e);
                                return [];
                            })
                    )
            );
            taskPageResults.forEach(files => allFiles.push(...files));
        } catch (err) {
            Logger.error(`Error fetching subject "${link.subject}":`, err);
        }
    }

    const uniqueTasks = [...new Map(allTasks.map(t => [t.id, t])).values()];
    const cache = {
        timestamp: Date.now(),
        tasks: uniqueTasks,
        files: allFiles
    };

    await chrome.storage.local.set({ lastScrape: cache });
}

function updateBadge(count, hasOverdue) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: String(count) });
        chrome.action.setBadgeBackgroundColor({ 
            color: hasOverdue ? '#dc2626' : '#ea580c' 
        });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

/**
 * Validates that the Notion database has the required columns.
 * Required columns: Name (title), Subject, Due Date, Link
 *
 * @param {string} token - Notion API bearer token
 * @param {string} dbId - Target Notion database ID
 * @returns {Promise<{valid: boolean, missing: string[], error?: string}>}
 */
async function validateDatabaseSchema(token, dbId) {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Notion-Version": "2022-06-28"
            }
        });

        if (!response.ok) {
            const err = await response.json();
            if (err.code === 'object_not_found') {
                return { valid: false, missing: [], error: "Database not found. Please check the Database ID." };
            }
            return { valid: false, missing: [], error: `Database error: ${err.message || 'Unknown error'}` };
        }

        const db = await response.json();
        const properties = db.properties || {};
        const missing = [];

        // Check for Name (title) property - it might be named differently
        const titleProp = Object.entries(properties).find(([key, prop]) => prop.type === 'title');
        if (!titleProp) {
            missing.push('Name (title)');
        }

        // Check for Subject property
        if (!properties['Subject']) {
            missing.push('Subject');
        }

        // Check for Due Date property (can be date type or rich_text)
        if (!properties['Due Date']) {
            missing.push('Due Date');
        }

        // Check for Link property (url type)
        if (!properties['Link']) {
            missing.push('Link (URL)');
        }

        return { valid: missing.length === 0, missing };
    } catch (error) {
        Logger.error("Schema validation error:", error);
        return { valid: false, missing: [], error: "Failed to validate database schema." };
    }
}

/**
 * Fetches the names of all existing pages in a Notion database.
 * Used to prevent pushing duplicate tasks.
 *
 * @param {string} token - Notion API bearer token
 * @param {string} dbId - Target Notion database ID
 * @returns {Promise<Set<string>>} Lowercase set of existing task names
 */
async function fetchExistingTaskNames(token, dbId) {
    const existing = new Set();
    let cursor = undefined;

    try {
        do {
            const body = { page_size: 100 };
            if (cursor) body.start_cursor = cursor;

            const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) return existing;

            const data = await response.json();
            for (const page of data.results) {
                const titleProp = Object.values(page.properties).find(p => p.type === 'title');
                const name = titleProp?.title?.[0]?.plain_text?.toLowerCase();
                if (name) existing.add(name);
            }

            cursor = data.has_more ? data.next_cursor : undefined;
        } while (cursor);
    } catch (err) {
        Logger.error('Could not fetch existing Notion tasks:', err);
    }

    return existing;
}

/**
 * Pushes an array of task objects to a Notion database.
 * Skips tasks that already exist (matched by name) to prevent duplicates.
 * Implements rate limiting to stay within Notion API limits (~3 requests/second).
 *
 * @param {Array<{name: string, subject: string, date: string, link: string}>} tasks - Tasks to upload
 * @param {string} token - Notion API bearer token (starts with 'secret_' or 'ntn_')
 * @param {string} dbId - Target Notion database ID (32 hex characters)
 * @returns {Promise<{success: boolean, message: string}>} Result object
 */
async function pushToNotion(tasks, token, dbId) {
    try {
        // Validate schema first
        const validation = await validateDatabaseSchema(token, dbId);

        if (!validation.valid) {
            if (validation.error) {
                return { success: false, message: validation.error };
            }
            const missingList = validation.missing.join(', ');
            return {
                success: false,
                message: `Missing required columns in Notion database: ${missingList}. Please add these columns and try again.`
            };
        }

        const existingNames = await fetchExistingTaskNames(token, dbId);
        const newTasks = tasks.filter(t => !existingNames.has(t.name.toLowerCase()));
        const skippedCount = tasks.length - newTasks.length;

        if (newTasks.length === 0) {
            return { success: true, message: `All ${skippedCount} tasks already exist in Notion — nothing to add.` };
        }

        let successCount = 0;
        let failCount = 0;

        for (const task of newTasks) {
            const response = await fetch("https://api.notion.com/v1/pages", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "Notion-Version": "2022-06-28"
                },
                body: JSON.stringify({
                    "parent": { "database_id": dbId },
                    "properties": {
                        // Task name as the page title
                        "Name": { "title": [{ "text": { "content": task.name } }] },
                        // Subject/course as rich text
                        "Subject": { "rich_text": [{ "text": { "content": task.subject } }] },
                        // Due date as rich text (format varies from source)
                        "Due Date": { "rich_text": [{ "text": { "content": task.date } }] },
                        // Direct link to the assignment
                        "Link": { "url": task.link }
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                Logger.error("Notion Error:", err);
                failCount++;
            } else {
                successCount++;
            }

            // Rate limiting: ~3 requests per second to avoid Notion API limits
            await new Promise(resolve => setTimeout(resolve, 350));
        }

        const skipNote = skippedCount > 0 ? ` (${skippedCount} already existed, skipped)` : '';
        if (failCount === 0) {
            return { success: true, message: `${successCount} tasks added to Notion.${skipNote}` };
        } else if (successCount === 0) {
            return { success: false, message: `All tasks failed to add.${skipNote} Check the console for details.` };
        } else {
            return { success: true, message: `${successCount} added, ${failCount} failed.${skipNote}` };
        }
    } catch (error) {
        Logger.error("Notion API Error:", error);
        return { success: false, message: "Network Error: Unable to connect to Notion." };
    }
}
