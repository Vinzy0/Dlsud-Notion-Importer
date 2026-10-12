import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendTasks, disconnectNotion } from '../notion.js';
import { parseDate } from '../dates.js';

process.env.TZ = 'Asia/Manila';
const RealDate = Date;
function freezeDate(iso) {
    globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [iso])); }
        static now() { return new RealDate(iso).getTime(); }
    };
}
const task = { id: 't1', name: 'Assignment', subject: 'CS101', date: 'Oct 15', link: 'https://dlsud.edu20.org/task/1' };

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
