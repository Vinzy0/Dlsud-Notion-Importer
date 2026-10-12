import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendTasks, disconnectNotion, saveNotionSyncResult } from '../notion.js';
import { parseDate } from '../dates.js';

process.env.TZ = 'Asia/Manila';
globalThis.chrome = undefined;
globalThis.Logger = undefined;
const RealDate = Date;
function freezeDate(iso) {
    globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [iso])); }
        static now() { return new RealDate(iso).getTime(); }
    };
}

function mockNotionStorage(t) {
    const storage = { notionToken: 'test-token', notionDatabaseId: 'test-db', notionSyncedIds: ['old'] };
    t.mock.property(globalThis, 'chrome', { storage: { local: {
        set: async values => Object.assign(storage, values),
        remove: async keys => { for (const key of keys) delete storage[key]; },
    } } });
    const logs = [];
    t.mock.property(globalThis, 'Logger', { error: (...args) => logs.push(args) });
    return { storage, logs };
}

test('F5: 401 reports the error and stops using the invalid token', async (t) => {
    const { storage, logs } = mockNotionStorage(t);
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        calls++;
        return new Response(JSON.stringify({ code: 'unauthorized', message: 'API token is invalid.' }), { status: 401 });
    });
    const ids = new Set();
    const results = await sendTasks('test-token', 'test-db', [task, { ...task, id: 't2' }], ids);
    assert.equal(results.authExpired, true);
    assert.match(results.errors[0].message, /API token is invalid/);
    assert.equal(calls, 1);
    assert.equal(ids.size, 0);
    assert.match(JSON.stringify(logs), /API token is invalid/);
    await saveNotionSyncResult(results, ids);
    assert.equal('notionToken' in storage, false);
    assert.equal('notionSyncedIds' in storage, false);
    assert.match(storage.notionSyncError, /Reconnect/);
});

test('F5: 429 honors Retry-After, then succeeds without duplicate IDs', async (t) => {
    const { storage } = mockNotionStorage(t);
    const waits = [];
    t.mock.method(globalThis, 'setTimeout', (fn, ms) => { waits.push(ms); fn(); });
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => ++calls === 1
        ? new Response('{"message":"Slow down"}', { status: 429, headers: { 'Retry-After': '7' } })
        : new Response('{}', { status: 200 }));
    const ids = new Set();
    const results = await sendTasks('test-token', 'test-db', [task], ids);
    assert.equal(calls, 2);
    assert.equal(results.created, 1);
    assert.equal(results.failed, 0);
    assert.equal(ids.size, 1);
    assert.ok(waits[0] >= 7000);
    await saveNotionSyncResult(results, ids);
    assert.deepEqual(storage.notionSyncedIds, ['t1']);
    assert.equal('notionSyncError' in storage, false);
});

test('F5: 429 retries stop after three retries and surface the final body', async (t) => {
    const { storage } = mockNotionStorage(t);
    const waits = [];
    t.mock.method(globalThis, 'setTimeout', (fn, ms) => { waits.push(ms); fn(); });
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        calls++;
        return new Response('{"message":"Still rate limited"}', { status: 429, headers: { 'Retry-After': '1' } });
    });
    const ids = new Set();
    const results = await sendTasks('test-token', 'test-db', [task], ids);
    assert.equal(calls, 4);
    assert.equal(waits.length, 3);
    assert.ok(waits[1] > waits[0] && waits[2] > waits[1]);
    assert.equal(results.failed, 1);
    assert.equal(ids.size, 0);
    assert.match(results.errors[0].message, /Still rate limited/);
    await saveNotionSyncResult(results, ids);
    assert.match(storage.notionSyncError, /Still rate limited/);
});
const task = { id: 't1', name: 'Assignment', subject: 'CS101', date: 'Oct 15', link: 'https://dlsud.edu20.org/task/1' };

test('F4: disconnect clears the old sync IDs and database URL', async (t) => {
    const storage = {
        notionToken: 'test-token', notionDatabaseId: 'test-db', notionWorkspaceName: 'test-workspace',
        notionSyncedIds: ['t1'], notionDatabaseUrl: 'https://notion.so/test-db', lastScrape: { tasks: [task] },
    };
    t.mock.property(globalThis, 'chrome', { storage: { local: {
        remove: async keys => { for (const key of keys) delete storage[key]; },
    } } });
    await disconnectNotion();
    for (const key of ['notionToken', 'notionDatabaseId', 'notionWorkspaceName', 'notionSyncedIds', 'notionDatabaseUrl']) {
        assert.equal(key in storage, false, `${key} should be gone`);
    }
    assert.deepEqual(storage.lastScrape.tasks, [task]);
});

test('F1: Notion receives the local calendar day in Asia/Manila', async (t) => {
    freezeDate('2026-10-12T12:00:00+08:00');
    t.after(() => { globalThis.Date = RealDate; });
    let sent;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        sent = JSON.parse(options.body);
        return new Response('{}', { status: 200 });
    });
    await sendTasks('test-token', 'test-db', [task], new Set());
    assert.equal(sent.properties['Due Date'].date.start, '2026-10-15');
});

for (const [today, raw, year, month, day] of [
    ['2027-01-05', 'Dec 20', 2026, 11, 20],
    ['2026-12-20', 'Jan 5', 2027, 0, 5],
    ['2026-10-12', 'Oct 15', 2026, 9, 15],
]) {
    test(`F2: ${raw} chooses the closest year on ${today}`, async (t) => {
        freezeDate(`${today}T12:00:00+08:00`);
        t.after(() => { globalThis.Date = RealDate; });
        const date = parseDate(raw);
        assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate()], [year, month, day]);
        let sent;
        t.mock.method(globalThis, 'fetch', async (_url, options) => {
            sent = JSON.parse(options.body);
            return new Response('{}', { status: 200 });
        });
        await sendTasks('test-token', 'test-db', [{ ...task, date: raw }], new Set());
        assert.equal(sent.properties['Due Date'].date.start, `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    });
}
