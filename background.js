importScripts('logger.js');
importScripts('scraper.js');

// ============================================================
// Notion OAuth — runs here so the flow survives popup close
// ============================================================

const NOTION_CLIENT_ID  = '350d872b-594c-81ca-8ed8-0037012c42d1';
const NOTION_WORKER_URL = 'https://udscraper.sapture.workers.dev';
const NOTION_VERSION    = '2022-06-28';

function buildNotionAuthUrl() {
    const redirectUri = chrome.identity.getRedirectURL();
    const params = new URLSearchParams({
        client_id:     NOTION_CLIENT_ID,
        response_type: 'code',
        owner:         'user',
        redirect_uri:  redirectUri,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params}`;
}

async function notionExchangeCode(code) {
    const resp = await fetch(NOTION_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: chrome.identity.getRedirectURL() }),
    });
    if (!resp.ok) throw new Error(`Worker error ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
}

async function notionSetupDatabase(token) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
    };

    const searchResp = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 1 }),
    });
    if (!searchResp.ok) throw new Error('Could not search Notion pages');
    const { results } = await searchResp.json();
    if (!results.length) throw new Error('No pages shared. During login, select at least one page to share.');

    const dbResp = await fetch('https://api.notion.com/v1/databases', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            parent: { type: 'page_id', page_id: results[0].id },
            title:  [{ type: 'text', text: { content: 'DLSUD Tasks' } }],
            properties: {
                'Name':     { title: {} },
                'Subject':  { select: {} },
                'Due Date': { date: {} },
                'Link':     { url: {} },
                'Status': {
                    select: {
                        options: [
                            { name: 'Not Started', color: 'gray' },
                            { name: 'In Progress', color: 'blue' },
                            { name: 'Done',        color: 'green' },
                        ],
                    },
                },
            },
        }),
    });
    if (!dbResp.ok) throw new Error('Could not create database in Notion');
    const db = await dbResp.json();
    return { id: db.id, url: db.url || '' };
}

async function runNotionConnect() {
    // Keep the service worker alive with a recurring alarm while OAuth is in flight.
    // MV3 workers get killed after ~30s of inactivity without this.
    await chrome.alarms.create('notionOAuthKeepAlive', { periodInMinutes: 0.4 });
    try {
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: buildNotionAuthUrl(),
            interactive: true,
        });
        const code = new URL(redirectUrl).searchParams.get('code');
        if (!code) throw new Error('No code returned from Notion');

        const tokenData = await notionExchangeCode(code);
        const db        = await notionSetupDatabase(tokenData.access_token);

        await chrome.storage.local.set({
            notionToken:         tokenData.access_token,
            notionDatabaseId:    db.id,
            notionWorkspaceName: tokenData.workspace_name || 'Notion',
            notionDatabaseUrl:   db.url,
        });

        await chrome.storage.local.remove('notionConnectError');
        return { success: true, workspaceName: tokenData.workspace_name || 'Notion', dbUrl: db.url };
    } catch (err) {
        Logger.error('Notion connect error:', err.message, err);
        await chrome.storage.local.set({ notionConnectError: err.message });
        return { success: false, error: err.message };
    } finally {
        chrome.alarms.clear('notionOAuthKeepAlive');
    }
}

// ============================================================
// Message Router
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ pong: true });
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

    if (request.action === 'notionConnect') {
        runNotionConnect().then(result => {
            chrome.runtime.sendMessage({ action: 'notionConnectResult', ...result }, () => {
                void chrome.runtime.lastError; // suppress "popup is closed" error
            });
        });
        sendResponse({ started: true });
        return true;
    }
});

async function getOffscreenDocument() {
    const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (existing.length > 0) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Parse HTML fetched from LMS pages'
    });
}

async function parseSubjectPageOffscreen(html, subject, url) {
    await getOffscreenDocument();
    return new Promise(resolve => {
        chrome.runtime.sendMessage(
            { target: 'offscreen', action: 'parseSubjectPage', html, subject, url },
            res => resolve(res?.tasks ?? [])
        );
    });
}

async function findFilesOnPageOffscreen(html, subject, taskName, url) {
    await getOffscreenDocument();
    return new Promise(resolve => {
        chrome.runtime.sendMessage(
            { target: 'offscreen', action: 'findFilesOnPage', html, subject, taskName, url },
            res => resolve(res?.files ?? [])
        );
    });
}

async function runDeepScan(subjectLinks) {
    const allTasks = [];
    const allFiles = [];

    for (let i = 0; i < subjectLinks.length; i++) {
        const link = subjectLinks[i];
        try {
            chrome.runtime.sendMessage(
                { action: 'scanProgress', current: i + 1, total: subjectLinks.length, subject: link.subject },
                () => { void chrome.runtime.lastError; }
            );
        } catch (_) {}

        try {
            const response = await fetch(link.url);
            const text = await response.text();

            const tasks = await parseSubjectPageOffscreen(text, cleanSubject(link.subject), link.url);
            allTasks.push(...tasks);

            const taskPageResults = await Promise.all(
                tasks
                    .filter(task => task.link && task.link !== link.url)
                    .map(task =>
                        fetch(task.link)
                            .then(r => r.text())
                            .then(html => findFilesOnPageOffscreen(html, task.subject, task.name, task.link))
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

