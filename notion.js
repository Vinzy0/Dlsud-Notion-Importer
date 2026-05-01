// ==========================================
// notion.js — Notion OAuth & API Integration
// ==========================================
// ⚠️  After setup, fill in these two constants:
const NOTION_CLIENT_ID = '350d872b-594c-81ca-8ed8-0037012c42d1';
const WORKER_URL       = 'https://udscraper.sapture.workers.dev';

const NOTION_VERSION = '2022-06-28';

/** Returns the OAuth redirect URI for this extension instance. */
function getRedirectUri() {
    return chrome.identity.getRedirectURL();
}

/** Builds the Notion OAuth authorization URL. */
export function getAuthUrl() {
    const params = new URLSearchParams({
        client_id:     NOTION_CLIENT_ID,
        response_type: 'code',
        owner:         'user',
        redirect_uri:  getRedirectUri(),
    });
    return `https://api.notion.com/v1/oauth/authorize?${params}`;
}

/**
 * Exchanges an OAuth code for an access token via the Cloudflare Worker.
 * @param {string} code
 * @returns {Promise<{ access_token: string, workspace_name: string, workspace_icon: string }>}
 */
export async function exchangeCode(code) {
    const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: getRedirectUri() }),
    });
    if (!resp.ok) throw new Error(`Worker error ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
}

/**
 * Finds the first accessible Notion page and creates the DLSUD Tasks database inside it.
 * @param {string} token
 * @returns {Promise<string>} New database ID
 */
export async function setupDatabase(token) {
    const searchResp = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 1 }),
    });
    if (!searchResp.ok) throw new Error('Could not search Notion pages');

    const { results } = await searchResp.json();
    if (!results.length) throw new Error('No pages were shared. During the Notion login, select at least one page to share with the integration.');

    const dbResp = await fetch('https://api.notion.com/v1/databases', {
        method: 'POST',
        headers: notionHeaders(token),
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
    return db.id;
}

/**
 * Creates Notion pages for each task, skipping already-synced ones.
 * Mutates syncedIds in-place to track newly created entries.
 * @param {string} token
 * @param {string} databaseId
 * @param {Array}  tasks
 * @param {Set<string>} syncedIds
 * @returns {Promise<{ created: number, skipped: number, failed: number }>}
 */
export async function sendTasks(token, databaseId, tasks, syncedIds) {
    const results = { created: 0, skipped: 0, failed: 0 };

    for (const task of tasks) {
        if (syncedIds.has(task.id)) { results.skipped++; continue; }

        try {
            const dueDate = parseDateToISO(task.date);
            const resp = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: notionHeaders(token),
                body: JSON.stringify({
                    parent: { database_id: databaseId },
                    properties: {
                        'Name':    { title: [{ text: { content: task.name } }] },
                        'Subject': { select: { name: task.subject } },
                        'Link':    { url: task.link },
                        ...(dueDate ? { 'Due Date': { date: { start: dueDate } } } : {}),
                    },
                }),
            });
            if (resp.ok) { syncedIds.add(task.id); results.created++; }
            else results.failed++;
        } catch {
            results.failed++;
        }
    }

    return results;
}

function notionHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
    };
}

function parseDateToISO(rawDate) {
    if (!rawDate || rawDate === 'No Due Date' || rawDate === 'Check Link') return null;
    const match = rawDate.match(/^[A-Z][a-z]{2}\s\d+/);
    if (!match) return null;
    const d = new Date(`${match[0]} ${new Date().getFullYear()}`);
    if (isNaN(d.getTime())) return null;
    if (new Date() - d > 180 * 24 * 60 * 60 * 1000) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
}
