import assert from 'node:assert/strict';
import { test } from 'node:test';

class Element {
    dataset = {}; style = {}; textContent = ''; innerHTML = ''; children = [];
    classes = new Set(); listeners = {};
    classList = {
        add: (...names) => names.forEach(n => this.classes.add(n)),
        remove: (...names) => names.forEach(n => this.classes.delete(n)),
        contains: name => this.classes.has(name),
        toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name),
    };
    addEventListener(name, fn) { this.listeners[name] = fn; }
    appendChild(el) { this.children.push(el); return el; }
    append(...els) { this.children.push(...els); }
    setAttribute() {}
    querySelectorAll() { return []; }
}
const nodes = new Map();
const node = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
};
globalThis.document = {
    body: new Element(),
    getElementById: node, querySelector: node, querySelectorAll: () => [],
    createElement: () => new Element(), addEventListener() {},
};
globalThis.Logger = { error() {}, warn() {} };
globalThis.requestAnimationFrame = fn => fn();
// chrome.scripting serializes this global; its mocked result is supplied below.
globalThis.scrapeWidgetLinks = () => {};
const { doFetch, loadCache } = await import('../actions.js');

function mockChrome(t, storage, onScan) {
    const scanListeners = new Set();
    const progressListeners = new Set();
    const event = listeners => ({ addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) });
    const previous = globalThis.chrome;
    globalThis.chrome = {
        tabs: { query: async () => [{ id: 1, url: 'https://dlsud.edu20.org/home' }] },
        scripting: { executeScript: async () => [{ result: [{ subject: 'CS101', url: 'https://dlsud.edu20.org/subject/1' }] }] },
        storage: {
            local: { get: (_keys, callback) => callback(storage) },
            onChanged: event(scanListeners),
        },
        runtime: {
            onMessage: event(progressListeners),
            sendMessage: message => { if (message.action === 'doDeepScan') onScan(scanListeners); },
        },
    };
    t.after(() => { globalThis.chrome = previous; });
    t.mock.method(globalThis, 'setTimeout', () => 0);
    return { scanListeners, progressListeners };
}

test('F3 partial: repeated identical scan errors finish the popup and show an LMS error', async (t) => {
    const storage = { lastScanError: 'CS101: LMS returned HTTP 403' };
    let finishedAt = 100;
    const { scanListeners, progressListeners } = mockChrome(t, storage, listeners => {
        for (const listener of [...listeners]) listener({
            lastScanResult: { newValue: { success: false, finishedAt: ++finishedAt } },
        }, 'local');
    });
    for (let i = 0; i < 2; i++) {
        await doFetch();
        assert.equal(document.body.dataset.fetching, undefined);
        assert.equal(node('empty-title').textContent, "Couldn't reach the LMS");
        assert.equal(scanListeners.size, 0);
        assert.equal(progressListeners.size, 0);
    }
});

test('F5: reopening the popup shows a saved Notion error', (t) => {
    mockChrome(t, { notionSyncError: 'Notion 401: Reconnect to Notion in Settings.' }, () => {});
    const container = node('toast-container');
    container.children = [];
    loadCache();
    assert.ok(container.children.some(toast => toast.children.some(child => /Reconnect/.test(child.textContent))));
});
