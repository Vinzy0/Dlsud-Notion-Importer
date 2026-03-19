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
});

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
        console.error("Schema validation error:", error);
        return { valid: false, missing: [], error: "Failed to validate database schema." };
    }
}

/**
 * Pushes an array of task objects to a Notion database.
 * Creates a new page in Notion for each task with Name, Subject, Due Date, and Link.
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

        let successCount = 0;
        let failCount = 0;

        for (const task of tasks) {
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
                console.error("Notion Error:", err);
                failCount++;
            } else {
                successCount++;
            }

            // Rate limiting: ~3 requests per second to avoid Notion API limits
            await new Promise(resolve => setTimeout(resolve, 350));
        }

        if (failCount === 0) {
            return { success: true, message: `${successCount} tasks added to Notion.` };
        } else if (successCount === 0) {
            return { success: false, message: "All tasks failed. Check Console for details." };
        } else {
            return { success: true, message: `${successCount} added, ${failCount} failed.` };
        }
    } catch (error) {
        console.error("Notion API Error:", error);
        return { success: false, message: "Network Error: Unable to connect to Notion." };
    }
}
