// ==========================================
// worker.js — Cloudflare Worker
// Deploy this to Cloudflare Workers. Add two environment variables:
//   NOTION_CLIENT_ID     — from notion.so/my-integrations
//   NOTION_CLIENT_SECRET — from notion.so/my-integrations
// ==========================================

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

        let body;
        try { body = await request.json(); }
        catch { return json({ error: 'Invalid JSON' }, 400); }

        const { code, redirect_uri } = body;
        if (!code || !redirect_uri) return json({ error: 'Missing code or redirect_uri' }, 400);

        const credentials = btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`);
        const resp = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri }),
        });

        const data = await resp.json();
        return json(data, resp.status);
    },
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
