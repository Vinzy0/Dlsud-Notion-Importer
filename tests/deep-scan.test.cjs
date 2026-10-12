const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cleanSubject } = require('../scraper.js');
global.importScripts = () => {};
global.cleanSubject = cleanSubject;
global.Logger = { error() {} };
global.chrome = { runtime: { onMessage: { addListener() {} } } };
const { runDeepScan } = require('../background.js');
const link = { subject: 'CS101', url: 'https://dlsud.edu20.org/subject/1' };

function mockScan(t, tasks = []) {
    const old = { timestamp: 123, tasks: [{ id: 'old' }], files: [] };
    const storage = { lastScrape: old };
    t.mock.property(global, 'chrome', {
        storage: { local: { set: async values => Object.assign(storage, values) } },
        runtime: {
            lastError: null,
            getContexts: async () => [{}],
            sendMessage: (msg, callback) => {
                if (msg.action === 'parseSubjectPage') callback({ tasks });
                else if (msg.action === 'findFilesOnPage') callback({ files: [] });
                else callback();
            },
        },
    });
    return { storage, old };
}

test('F3 partial: network failure leaves lastScrape unchanged and records an error', async (t) => {
    const { storage, old } = mockScan(t);
    t.mock.method(global, 'fetch', async () => { throw new Error('Network down'); });
    await runDeepScan([link]);
    assert.equal(storage.lastScrape, old);
    assert.match(storage.lastScanError, /Network down/);
});

test('F3 partial: HTTP failure is rejected before parsing and preserves the cache', async (t) => {
    const { storage, old } = mockScan(t);
    t.mock.method(global, 'fetch', async () => new Response('Forbidden', { status: 403 }));
    await runDeepScan([link]);
    assert.equal(storage.lastScrape, old);
    assert.match(storage.lastScanError, /403/);
});

test('F3 partial: partial subject failure does not replace the complete old cache', async (t) => {
    const { storage, old } = mockScan(t, [{ id: 'new', link: link.url }]);
    let calls = 0;
    t.mock.method(global, 'fetch', async () => ++calls === 1
        ? new Response('<html>Subject</html>') : new Response('Unavailable', { status: 503 }));
    await runDeepScan([link, { ...link, url: link.url + '/2' }]);
    assert.equal(storage.lastScrape, old);
    assert.match(storage.lastScanError, /503/);
});

test('F3 partial: missing parser response is an error, not a successful empty scan', async (t) => {
    const { storage, old } = mockScan(t);
    t.mock.method(global, 'fetch', async () => new Response('<html>Subject</html>'));
    t.mock.method(chrome.runtime, 'sendMessage', (_msg, callback) => callback());
    await runDeepScan([link]);
    assert.equal(storage.lastScrape, old);
    assert.match(storage.lastScanError, /parser/i);
});

test('F3 partial: a successful scan replaces the cache and clears the old error', async (t) => {
    const tasks = [{ id: 'new', link: link.url }];
    const { storage, old } = mockScan(t, tasks);
    storage.lastScanError = 'Previous error';
    t.mock.method(global, 'fetch', async () => new Response('<html>Subject</html>'));
    await runDeepScan([link]);
    assert.notEqual(storage.lastScrape, old);
    assert.deepEqual(storage.lastScrape.tasks, tasks);
    assert.equal(storage.lastScanError, null);
});

test('F3 partial: a valid empty parser result can clear old tasks', async (t) => {
    const { storage } = mockScan(t);
    t.mock.method(global, 'fetch', async () => new Response('<html>Subject</html>'));
    await runDeepScan([link]);
    assert.deepEqual(storage.lastScrape.tasks, []);
    assert.equal(storage.lastScanError, null);
});
