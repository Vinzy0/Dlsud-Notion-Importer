/**
 * Unit tests for UDScraper pure helper functions.
 * Run with: node tests/unit.test.js
 *
 * Functions under test (keep in sync with popup.js):
 *   - cleanSubject   (scraper.js ~line 21)
 *   - parseDate      (ui.js ~line 117)
 *   - getUrgencyInfo (ui.js ~line 133)
 */

'use strict';
const assert = require('assert');

// ============================================================
// Freeze time to a fixed date for deterministic date tests.
// All date-relative assertions below are anchored to 2026-03-28.
// ============================================================
const FROZEN = '2026-03-28T12:00:00';
const RealDate = Date;
class MockDate extends RealDate {
    constructor(...args) {
        if (args.length === 0) super(FROZEN);
        else super(...args);
    }
    static now() { return new RealDate(FROZEN).getTime(); }
}
Object.setPrototypeOf(MockDate, RealDate); // preserve static methods
global.Date = MockDate;

// ============================================================
// Functions under test — inline copies from popup.js
// ============================================================

function cleanSubject(s) {
    if (!s) return s;
    return s
        .replace(/^\s*-\s*|\s*-\s*$/g, '')
        .replace(/\[\d+\]/g, '')
        .replace(/\[([^\]]+)\]/g, (m, g) => g)
        .replace(/\s+/g, ' ')
        .trim();
}

function parseDate(rawString) {
    if (!rawString || rawString === "No Due Date" || rawString === "Check Link") return null;
    const match = rawString.match(/^[A-Z][a-z]{2}\s\d+/);
    if (!match) return null;
    const currentYear = new Date().getFullYear();
    const d = new Date(`${match[0]} ${currentYear}`);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    if (now - d > 180 * 24 * 60 * 60 * 1000) d.setFullYear(d.getFullYear() + 1);
    return d;
}

function getUrgencyInfo(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return { label: dateStr || 'No date', class: '', urgency: '' };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0)  return { label: 'OVERDUE',   class: 'urgency-overdue',   urgency: 'overdue'   };
    if (diffDays === 0) return { label: 'TODAY',     class: 'urgency-today',     urgency: 'today'     };
    if (diffDays === 1) return { label: 'TOMORROW',  class: 'urgency-tomorrow',  urgency: 'tomorrow'  };
    if (diffDays <= 3)  return { label: `${diffDays}d left`, class: 'urgency-soon', urgency: 'soon'   };
    if (diffDays <= 7)  return { label: `${diffDays} days`,  class: '',           urgency: ''          };
    return { label: dateStr, class: '', urgency: '' };
}

// ============================================================
// Test runner
// ============================================================
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓  ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗  ${name}`);
        console.error(`       ${e.message}`);
        failed++;
    }
}

// ============================================================
// cleanSubject
// ============================================================
console.log('\ncleanSubject');

test('returns falsy input unchanged (null)', () => {
    assert.strictEqual(cleanSubject(null), null);
});

test('returns falsy input unchanged (empty string)', () => {
    assert.strictEqual(cleanSubject(''), '');
});

test('strips leading dash', () => {
    assert.strictEqual(cleanSubject('- MATH101'), 'MATH101');
});

test('strips trailing dash', () => {
    assert.strictEqual(cleanSubject('MATH101 -'), 'MATH101');
});

test('strips both leading and trailing dashes', () => {
    assert.strictEqual(cleanSubject('- MATH101 -'), 'MATH101');
});

test('removes numeric bracket tags like [3]', () => {
    assert.strictEqual(cleanSubject('CHEM101 [3]'), 'CHEM101');
});

test('unwraps non-numeric bracket content like [Section A]', () => {
    assert.strictEqual(cleanSubject('PHYS [Section A]'), 'PHYS Section A');
});

test('collapses multiple spaces', () => {
    assert.strictEqual(cleanSubject('CS   101'), 'CS 101');
});

test('combined: dashes, numeric brackets, whitespace', () => {
    assert.strictEqual(cleanSubject('- CS101 [2] -'), 'CS101');
});

test('combined: non-numeric brackets preserved as text', () => {
    assert.strictEqual(cleanSubject('- HUM [Elective] [2] -'), 'HUM Elective');
});

// ============================================================
// parseDate  (frozen date: 2026-03-28)
// ============================================================
console.log('\nparseDate');

test('returns null for null input', () => {
    assert.strictEqual(parseDate(null), null);
});

test('returns null for "No Due Date"', () => {
    assert.strictEqual(parseDate('No Due Date'), null);
});

test('returns null for "Check Link"', () => {
    assert.strictEqual(parseDate('Check Link'), null);
});

test('returns null for a plain number string', () => {
    assert.strictEqual(parseDate('12345'), null);
});

test('returns null for garbage text', () => {
    assert.strictEqual(parseDate('lorem ipsum'), null);
});

test('parses "Mar 28" to a Date object', () => {
    const d = parseDate('Mar 28');
    assert.ok(d instanceof RealDate, 'should return a Date');
    assert.strictEqual(d.getMonth(), 2);    // 0-indexed: March = 2
    assert.strictEqual(d.getDate(), 28);
    assert.strictEqual(d.getFullYear(), 2026);
});

test('parses "Jun 15" (future date) and stays in current year', () => {
    const d = parseDate('Jun 15');
    assert.ok(d instanceof RealDate);
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 5);    // June = 5
});

test('parses "Jan 05" (recent past, <180 days) and stays in current year', () => {
    // Jan 5 2026 is ~82 days before Mar 28 2026 — does NOT trigger year bump
    const d = parseDate('Jan 05');
    assert.ok(d instanceof RealDate);
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 0);    // January = 0
    assert.strictEqual(d.getDate(), 5);
});

test('ignores extra text after the date token', () => {
    // "Mar 28 at 11:59pm" — regex matches "Mar 28", rest is ignored
    const d = parseDate('Mar 28 at 11:59pm');
    assert.ok(d instanceof RealDate);
    assert.strictEqual(d.getMonth(), 2);
    assert.strictEqual(d.getDate(), 28);
});

// ============================================================
// getUrgencyInfo  (frozen date: 2026-03-28)
// ============================================================
console.log('\ngetUrgencyInfo');

test('non-date string passes label through unchanged', () => {
    const r = getUrgencyInfo('No Due Date');
    assert.strictEqual(r.label, 'No Due Date');
    assert.strictEqual(r.class, '');
    assert.strictEqual(r.urgency, '');
});

test('null/undefined dateStr returns fallback label', () => {
    const r = getUrgencyInfo(null);
    assert.strictEqual(r.label, 'No date');
    assert.strictEqual(r.urgency, '');
});

test('past date returns OVERDUE', () => {
    // Jan 01 2026 is 87 days before frozen date
    const r = getUrgencyInfo('Jan 01');
    assert.strictEqual(r.label, 'OVERDUE');
    assert.strictEqual(r.class, 'urgency-overdue');
    assert.strictEqual(r.urgency, 'overdue');
});

test('today returns TODAY', () => {
    const r = getUrgencyInfo('Mar 28');
    assert.strictEqual(r.label, 'TODAY');
    assert.strictEqual(r.class, 'urgency-today');
    assert.strictEqual(r.urgency, 'today');
});

test('tomorrow returns TOMORROW', () => {
    const r = getUrgencyInfo('Mar 29');
    assert.strictEqual(r.label, 'TOMORROW');
    assert.strictEqual(r.class, 'urgency-tomorrow');
    assert.strictEqual(r.urgency, 'tomorrow');
});

test('2 days away returns urgency-soon with "2d left"', () => {
    const r = getUrgencyInfo('Mar 30');
    assert.strictEqual(r.label, '2d left');
    assert.strictEqual(r.class, 'urgency-soon');
    assert.strictEqual(r.urgency, 'soon');
});

test('3 days away is the urgency-soon boundary', () => {
    const r = getUrgencyInfo('Mar 31');
    assert.strictEqual(r.label, '3d left');
    assert.strictEqual(r.urgency, 'soon');
});

test('7 days away returns "7 days" with no urgency class', () => {
    const r = getUrgencyInfo('Apr 04');
    assert.strictEqual(r.label, '7 days');
    assert.strictEqual(r.class, '');
    assert.strictEqual(r.urgency, '');
});

test('8+ days away returns the raw date string', () => {
    const r = getUrgencyInfo('Apr 05');
    assert.strictEqual(r.label, 'Apr 05');
    assert.strictEqual(r.class, '');
    assert.strictEqual(r.urgency, '');
});

// ============================================================
// Summary
// ============================================================
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
