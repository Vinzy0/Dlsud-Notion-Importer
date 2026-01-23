chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendToNotion") {
        // We now receive the keys in request.auth
        const { token, dbId } = request.auth;

        pushToNotion(request.data, token, dbId).then(msg => {
            sendResponse({ status: msg });
        });
        return true;
    }
});

async function pushToNotion(tasks, token, dbId) {
    try {
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
                        // Make sure these match your Notion columns exactly!
                        "Name": { "title": [{ "text": { "content": task.subject } }] },
                        "Count": { "number": parseInt(task.count) },
                        "Link": { "url": task.link }
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("Notion Error:", err);
                return "Error. Check Console.";
            }
        }
        return "Done! Check Notion.";
    } catch (error) {
        return `Network Error: ${error.message}`;
    }
}