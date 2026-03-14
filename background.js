/**
 * Listens for messages from the popup to send tasks to Notion.
 * @param {Object} request - The message request object
 * @param {string} request.action - The action type ('sendToNotion')
 * @param {Array} request.tasks - Array of task objects to upload
 * @param {string} request.token - Notion API bearer token
 * @param {string} request.dbId - Target Notion database ID
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
});

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
