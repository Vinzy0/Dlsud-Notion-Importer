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
