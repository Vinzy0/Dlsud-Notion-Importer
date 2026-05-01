// ==========================================
// actions.js - Side Effects, Event Wiring & Boot
// ==========================================
// Globals available from classic script tags in popup.html:
//   Logger            (logger.js)
//   scrapeWidgetLinks, parseSubjectPage, findFilesOnPage,
//   scrapeSubjectName, scrapeSidebarModules, cleanSubject, hashStr  (scraper.js)

import { State } from './state.js';
import {
    els, getEl, showToast, renderLoadingState, updateLoadingProgress, renderTasks, renderFiles,
    attachCheckboxListeners, updateActionBar, switchTab,
    openSettings, closeSettings,
    toggleDarkMode, showFileWarningIfNeeded,
    parseDate, updateBadge, applyTheme, isOnSubjectPage,
    updateSubjectFilterOptions, renderNotionSettings,
} from './ui.js';
import { sendTasks } from './notion.js';

// ============================================================
// Script Injection Helpers
// ============================================================

/**
 * Wraps chrome.scripting.executeScript with error handling.
 * Returns null (instead of throwing) if the injection fails.
 * @param {number} tabId
 * @param {object} options - Passed to executeScript (func/files/args)
 * @param {string} errorKey - Key into SCRIPT_ERROR_MESSAGES for UI feedback
 * @returns {Promise<Array|null>}
 */
async function safeScriptExecute(tabId, options, errorKey) {
    try {
        return await chrome.scripting.executeScript({ target: { tabId }, ...options });
    } catch (err) {
        Logger.error(`Script execution failed (${errorKey}):`, err);
        return null;
    }
}

const SCRIPT_ERROR_MESSAGES = {
    'scraper injection': { title: 'Error', text: 'Could not load page scanner. Try reloading the extension.' },
    'widget scrape':     { title: 'Error', text: 'Could not read tasks. Try refreshing the page.' },
    'context fetch':     { title: 'Error', text: 'Could not read page content. Try refreshing the page.' },
    'module scan':       { title: 'Error', text: 'Could not scan for modules. Try refreshing the page.' },
    'file scan':         { title: 'Error', text: 'Could not scan for files. Try refreshing the page.' },
};

/**
 * Shows a standardised script error in the status area.
 * @param {string} errorKey - Key into SCRIPT_ERROR_MESSAGES
 * @param {'tasks'|'due-soon'|'files'|null} [listId] - List to hide
 */
function showScriptError(errorKey, listId) {
    const msg = SCRIPT_ERROR_MESSAGES[errorKey] || { title: 'Error', text: 'Script execution failed. Try refreshing the page.' };
    if (listId) els.lists[listId]?.classList.add('hidden');
    els.statusMessage.classList.remove('hidden');
    els.emptyTitle.textContent = msg.title;
    els.statusText.textContent = msg.text;
    showToast(msg.text, 'error');
}

// ============================================================
// Fetch — Tasks
// ============================================================

let isFetching = false;

/** Sets isFetching and mirrors it onto body so ui.js can read it without a direct import. */
function setFetching(val) {
    isFetching = val;
    if (val) document.body.dataset.fetching = '1';
    else delete document.body.dataset.fetching;
}

/**
 * Reads the DLSU-D To-Do widget from the active tab, then hands off
 * the full fetch/parse loop to the background service worker.
 * The popup can be closed mid-scan — results are saved to storage
 * and picked up by chrome.storage.onChanged when the scan completes.
 */
async function doFetch() {
    if (isFetching) return;
    setFetching(true);

    els.statusMessage.classList.add('hidden');
    els.lists['tasks'].classList.remove('hidden');
    renderLoadingState(els.lists['tasks'], 'Looking for subjects...');

    State.tasks = [];
    State.files = [];
    els.lists['due-soon'].innerHTML = '';
    els.dueBadge.classList.add('hidden');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith('https://dlsud.edu20.org') && !tab.url.startsWith('http://dlsud.edu20.org'))) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'Wrong page';
            els.statusText.textContent = 'Please go to your dashboard first.';
            els.fetchInitialBtn.classList.remove('hidden');
            setFetching(false);
            return;
        }

        const results = await safeScriptExecute(tab.id, { func: scrapeWidgetLinks }, 'widget scrape');
        if (!results) {
            showScriptError('widget scrape', 'tasks');
            els.fetchInitialBtn.classList.remove('hidden');
            setFetching(false);
            return;
        }

        if (!results[0] || !results[0].result) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'No widget found';
            els.statusText.textContent = 'No To-Do widget found on this page.';
            els.fetchInitialBtn.classList.remove('hidden');
            setFetching(false);
            return;
        }

        const subjectLinks = results[0].result;

        if (subjectLinks.length === 0) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'All caught up';
            els.statusText.textContent = 'To-Do widget empty. No tasks found.';
            els.fetchInitialBtn.classList.remove('hidden');
            setFetching(false);
            return;
        }

        showToast(`Found ${subjectLinks.length} subjects. Scanning...`, 'info', 2000);
        updateLoadingProgress(`Found ${subjectLinks.length} subjects`, 0, subjectLinks.length);

        // Listen for per-subject progress updates from the background scan.
        const onScanProgress = (request) => {
            if (request.action !== 'scanProgress') return;
            updateLoadingProgress(
                `Fetching ${request.subject} (${request.current} of ${request.total})`,
                request.current,
                request.total
            );
        };
        chrome.runtime.onMessage.addListener(onScanProgress);

        // Listen for the background scan to write its results to storage.
        const onScanComplete = (changes, area) => {
            if (area !== 'local' || !changes.lastScrape) return;
            chrome.storage.onChanged.removeListener(onScanComplete);
            chrome.runtime.onMessage.removeListener(onScanProgress);

            const cache = changes.lastScrape.newValue;
            if (!cache || !cache.tasks || cache.tasks.length === 0) {
                els.lists['tasks'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
                els.emptyTitle.textContent = 'All caught up';
                els.statusText.textContent = 'No pending tasks found.';
                els.fetchInitialBtn.classList.remove('hidden');
            } else {
                loadCache();
                updateBadge();
                const fileNote = cache.files?.length > 0 ? ` and ${cache.files.length} files` : '';
                showToast(`Found ${cache.tasks.length} tasks${fileNote}`, 'success');
            }
            setFetching(false);
        };
        chrome.storage.onChanged.addListener(onScanComplete);

        chrome.runtime.sendMessage({ action: 'doDeepScan', subjectLinks });

    } catch (err) {
        Logger.error('Scrape Error:', err);
        els.lists['tasks'].classList.add('hidden');
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = 'Error';
        els.statusText.textContent = 'Error scanning. Check your connection.';
        els.fetchInitialBtn.classList.remove('hidden');
        showToast('Scan failed', 'error');
        setFetching(false);
    }
}

// ============================================================
// Fetch — Files
// ============================================================

/**
 * Scans the active subject page for downloadable files.
 * If the page has a sidebar, opens the module selector modal first.
 * If not, scans the current page directly.
 */
async function doFetchFilesOnly() {
    if (isFetching) return;
    setFetching(true);

    els.statusMessage.classList.add('hidden');
    els.lists['files'].classList.remove('hidden');
    renderLoadingState(els.lists['files'], 'Checking page...');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith('https://dlsud.edu20.org') && !tab.url.startsWith('http://dlsud.edu20.org'))) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'Wrong page';
            els.statusText.textContent = 'File fetching only works on subject pages. Navigate to a subject\'s module page and try again.';
            setFetching(false);
            return;
        }

        if (!isOnSubjectPage(tab.url)) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.fileWarning.classList.remove('hidden');
            els.fetchFilesInitialBtn.classList.add('hidden');
            els.emptyTitle.textContent = 'No files yet';
            els.statusText.textContent = 'Navigate to a subject page and fetch files';
            setFetching(false);
            return;
        }

        const injectionResult = await safeScriptExecute(tab.id, { files: ['scraper.js'] }, 'scraper injection');
        if (!injectionResult) {
            showScriptError('scraper injection', 'files');
            resetFileFetchButtons();
            return;
        }

        const results = await safeScriptExecute(tab.id, {
            func: () => ({
                subject:      scrapeSubjectName(),
                sidebarLinks: scrapeSidebarModules() || [],
                currentHref:  location.href,
                currentTitle: document.title,
            }),
        }, 'context fetch');
        if (!results) {
            showScriptError('context fetch', 'files');
            resetFileFetchButtons();
            return;
        }

        if (!results[0] || !results[0].result) throw new Error('Could not parse page context.');

        const context = results[0].result;

        if (context.sidebarLinks && context.sidebarLinks.length > 0) {
            State.pendingModuleLinks = context.sidebarLinks;
            State.pendingSubject     = cleanSubject(context.subject);

            els.moduleList.innerHTML = '';
            context.sidebarLinks.forEach((link, i) => {
                const item = document.createElement('div');
                item.className = 'module-item';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = `mod-${i}`;
                cb.className = 'module-checkbox';
                cb.value = String(i);
                cb.checked = true;

                const lbl = document.createElement('label');
                lbl.htmlFor = `mod-${i}`;
                lbl.title = link.title;
                lbl.textContent = link.title; // XSS-safe

                item.append(cb, lbl);
                els.moduleList.appendChild(item);
            });

            els.moduleSelectorModal.classList.add('visible');
            State._modalFocusTrapCleanup = trapFocus(els.moduleSelectorModal.querySelector('.modal-content'));
            if (State.files.length > 0) renderFiles();
            else {
                els.lists['files'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
            }
            setFetching(false);
            return;
        }

        showToast('No modules found. Scanning current page...', 'info', 2000);

        const fileResults = await safeScriptExecute(tab.id, {
            func: (subj, taskName, sourceUrl) => findFilesOnPage(document, subj, taskName, sourceUrl),
            args: [context.subject, context.currentTitle || 'Current Page', context.currentHref],
        }, 'file scan');
        if (!fileResults) {
            showScriptError('file scan', 'files');
            resetFileFetchButtons();
            return;
        }

        if (!fileResults[0]?.result?.length) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'No files found';
            els.statusText.textContent = 'No downloadable files found on this page.';
            resetFileFetchButtons();
            return;
        }

        State.files.push(...fileResults[0].result);
        saveAndRenderFiles();
        resetFileFetchButtons();
        showToast(`Found ${fileResults[0].result.length} files`, 'success');

    } catch (err) {
        Logger.error('Scrape Files Error:', err);
        els.lists['files'].classList.add('hidden');
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = 'Error';
        els.statusText.textContent = 'Error scanning page.';
        resetFileFetchButtons();
        showToast('File scan failed', 'error');
    } finally {
        setFetching(false);
    }
}

function resetFileFetchButtons() {
    els.fetchFilesInitialBtn.disabled = false;
    if (State.files.length === 0) els.fetchFilesInitialBtn.classList.remove('hidden');
}

/**
 * Merges newly found files into the cache without overwriting existing tasks.
 */
function saveAndRenderFiles() {
    chrome.storage.local.get(['lastScrape'], (items) => {
        const existing = items.lastScrape || {};
        const cache = {
            timestamp: Date.now(),
            tasks: State.tasks.length > 0 ? State.tasks : (existing.tasks || []),
            files: State.files,
        };
        chrome.storage.local.set({ lastScrape: cache }, () => loadCache());
    });
}

// ============================================================
// Cache / Boot
// ============================================================

/**
 * Loads persisted state from chrome.storage and renders the initial UI.
 * Called on DOMContentLoaded and after every background scan completes.
 */
export function loadCache() {
    chrome.storage.local.get(
        ['lastScrape', 'dismissedFileWarning', 'completedTaskIds', 'darkMode',
         'notionToken', 'notionDatabaseId', 'notionWorkspaceName', 'notionDatabaseUrl'],
        (items) => {
            State.dismissedFileWarning = items.dismissedFileWarning || false;

            if (items.completedTaskIds && Array.isArray(items.completedTaskIds)) {
                State.completedTaskIds = new Set(items.completedTaskIds);
            }

            if (items.darkMode) {
                State.darkMode = items.darkMode;
                applyTheme(State.darkMode);
                els.darkMode.checked = true;
            }

            if (items.notionToken && items.notionDatabaseId) {
                State.notionConnected = true;
                renderNotionSettings(true, items.notionWorkspaceName || 'Notion', items.notionDatabaseUrl || '');
            }

            if (items.notionConnectError) {
                showToast(items.notionConnectError, 'error', 6000);
                chrome.storage.local.remove('notionConnectError');
            }

            const cache = items.lastScrape;
            const AUTO_REFRESH_MS = 12 * 60 * 60 * 1000;

            if (cache?.tasks?.length > 0) {
                State.tasks = cache.tasks.map(t =>
                    t.id ? t : { ...t, id: hashStr(t.subject + t.name + t.link) }
                );
                State.files = cache.files || [];

                els.statusMessage.classList.add('hidden');
                renderTasks();
                renderFiles();
                updateBadge();

                const dueSoonItems = cache.tasks.filter(t => {
                    const d = parseDate(t.date);
                    if (!d) return false;
                    const now = new Date(); now.setHours(0, 0, 0, 0);
                    const target = new Date(d); target.setHours(0, 0, 0, 0);
                    return Math.ceil((target - now) / (1000 * 60 * 60 * 24)) <= 3;
                });

                switchTab(dueSoonItems.length > 0 ? 'due-soon' : 'tasks');

                if (cache.timestamp && Date.now() - cache.timestamp > AUTO_REFRESH_MS) {
                    doFetch();
                }

            } else if (cache?.files?.length > 0) {
                State.files = cache.files;
                renderFiles();
                els.statusMessage.classList.remove('hidden');
                els.taskControls.classList.add('hidden');
                els.emptyTitle.textContent = 'No tasks yet';
                els.statusText.textContent = 'Scrapes tasks and files from the LMS. Open your dashboard, then hit the button below.';
                showFileWarningIfNeeded();
            } else {
                els.statusMessage.classList.remove('hidden');
                els.taskControls.classList.add('hidden');
                els.emptyTitle.textContent = 'Fetch your DLSUD assignments';
                els.statusText.textContent = 'Scrapes tasks and files from the LMS. Open your dashboard, then hit the button below.';
                showFileWarningIfNeeded();
            }
        }
    );
}

// ============================================================
// Dropdown Toggle Helper
// ============================================================

/** Toggles one dropdown open while closing all others. Updates aria-expanded on the trigger. */
function toggleDropdown(dropdown) {
    const isHidden = dropdown.classList.contains('hidden');
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.custom-select-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    if (isHidden) {
        dropdown.classList.remove('hidden');
        const trigger = dropdown.previousElementSibling;
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }
}

/** Traps focus within a container element. Returns a cleanup function to remove the trap. */
function trapFocus(container) {
    const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    function onKeyDown(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
    }
    container.addEventListener('keydown', onKeyDown);
    if (first) first.focus();
    return () => container.removeEventListener('keydown', onKeyDown);
}

// ============================================================
// Custom Confirm Dialog (replaces native confirm which closes popups)
// ============================================================

let _confirmCleanup = null;

/**
 * Shows a custom confirm dialog inside the popup.
 * Returns a Promise that resolves to true (OK) or false (Cancel).
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const dialog   = getEl('confirmDialog');
        const titleEl  = getEl('confirmTitle');
        const descEl   = getEl('confirmDesc');
        const okBtn    = getEl('confirmOkBtn');
        const cancelBtn = getEl('confirmCancelBtn');

        titleEl.textContent = title;
        descEl.textContent  = message;
        dialog.classList.add('visible');
        _confirmCleanup = trapFocus(dialog.querySelector('.confirm-modal'));

        function cleanup(result) {
            dialog.classList.remove('visible');
            if (_confirmCleanup) { _confirmCleanup(); _confirmCleanup = null; }
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            dialog.querySelector('.modal-overlay').removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        }

        function onOk()      { cleanup(true); }
        function onCancel()  { cleanup(false); }
        function onKey(e)    { if (e.key === 'Escape') cleanup(false); }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        dialog.querySelector('.modal-overlay').addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
    });
}

// ============================================================
// Event Wiring
// ============================================================

// — Tabs —
els.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// — Settings —
els.settingsBtn.addEventListener('click', openSettings);
els.closeSettingsBtn.addEventListener('click', closeSettings);
els.settingsBackdrop.addEventListener('click', closeSettings);

els.clearDataBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Clear All Data?', 'This will clear all cached tasks, files, and credentials.');
    if (!confirmed) return;
    chrome.storage.local.clear(() => {
        State.tasks = [];
        State.files = [];
        State.selectedIds.clear();
        State.completedTaskIds.clear();
        State.searchQuery   = '';
        State.subjectFilter = '';
        State.sortBy        = 'dueDate';
        els.lists['tasks'].innerHTML    = '';
        els.lists['due-soon'].innerHTML = '';
        els.lists['files'].innerHTML    = '';
        els.dueBadge.classList.add('hidden');
        els.taskControls.classList.add('hidden');
        els.taskSearch.value            = '';
        els.subjectFilterLabel.textContent = 'All Subjects';
        els.sortSelectLabel.textContent    = 'Grouped';
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = 'Fetch your DLSUD assignments';
        els.statusText.textContent = 'Scrapes tasks and files from the LMS. Open your dashboard, then hit the button below.';
        els.fetchInitialBtn.classList.remove('hidden');
        State.notionConnected = false;
        renderNotionSettings(false);
        updateActionBar();
        closeSettings();
        showToast('All data cleared', 'info');
        chrome.runtime.sendMessage({ action: 'updateBadge', count: 0, hasOverdue: false });
    });
});

els.darkMode.addEventListener('change', (e) => toggleDarkMode(e.target.checked));

// — Action Bar —
els.closeActionsBtn.addEventListener('click', () => {
    State.selectedIds.clear();
    document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('#selectAllTasks').forEach(cb => cb.checked = false);
    updateActionBar();
});

// — Export —
els.exportBtn.addEventListener('click', async () => {
    const format        = els.exportSelect.value;
    const selectedTasks = [...State.selectedIds]
        .map(id => State.tasks.find(t => t.id === id))
        .filter(Boolean);

    if (selectedTasks.length === 0) { showToast('No tasks selected', 'error'); return; }

    if (format === 'text') {
        const text = selectedTasks.map(t => `${t.subject} — ${t.name} (${t.date || 'No date'})`).join('\n');
        await navigator.clipboard.writeText(text);
        showToast('Copied as plain text', 'success');

    } else if (format === 'markdown') {
        const md = selectedTasks.map(t => `- [ ] **${t.subject}**: ${t.name} — *${t.date || 'No date'}*`).join('\n');
        await navigator.clipboard.writeText(md);
        showToast('Copied as Markdown', 'success');

    } else if (format === 'csv') {
        const cell   = s => `"${(s || '').replace(/"/g, '""')}"`;
        const header = 'Subject,Task,Due Date,Link';
        const rows   = selectedTasks.map(t => [cell(t.subject), cell(t.name), cell(t.date), cell(t.link)].join(','));
        await navigator.clipboard.writeText([header, ...rows].join('\n'));
        showToast('Copied as CSV', 'success');
    }
});

// — Fetch buttons —
els.fetchInitialBtn.addEventListener('click', doFetch);
els.fetchFilesInitialBtn.addEventListener('click', doFetchFilesOnly);

// — Notion —
els.connectNotionBtn.addEventListener('click', doConnectNotion);
els.disconnectNotionBtn.addEventListener('click', doDisconnectNotion);
els.sendToNotionBtn.addEventListener('click', doSendToNotion);

// — Search (debounced) —
let searchDebounceTimer;
els.taskSearch.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        State.searchQuery = e.target.value;
        if (State.tasks.length > 0) renderTasks();
    }, 150);
});

// — Custom select keyboard support —
[els.subjectFilterBtn, els.sortSelectBtn].forEach(btn => {
    btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        if (e.key === 'Escape') {
            document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
            document.querySelectorAll('.custom-select-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
        }
    });
});

// — Subject filter dropdown —
els.subjectFilterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(els.subjectFilterDropdown);
    els.sortSelectDropdown.classList.add('hidden');
});

els.subjectFilterDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (!option) return;
    State.subjectFilter = option.dataset.value;
    els.subjectFilterLabel.textContent = option.textContent;
    els.subjectFilterDropdown.classList.add('hidden');
    document.querySelectorAll('#subjectFilterDropdown .custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === State.subjectFilter);
    });
    if (State.tasks.length > 0) renderTasks();
});

// — Sort dropdown —
els.sortSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(els.sortSelectDropdown);
    els.subjectFilterDropdown.classList.add('hidden');
});

els.sortSelectDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (!option) return;
    State.sortBy = option.dataset.value;
    els.sortSelectLabel.textContent = option.textContent;
    els.sortSelectDropdown.classList.add('hidden');
    document.querySelectorAll('#sortSelectDropdown .custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === State.sortBy);
    });
    if (State.tasks.length > 0) renderTasks();
});

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
});

// — Keyboard shortcuts —
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (els.settingsPanel.classList.contains('open')) return;
    if (e.key.toLowerCase() === 'r') doFetch();
    if (e.key.toLowerCase() === 's') openSettings();
});

// — Delegated refresh clicks (rendered dynamically inside lists) —
els.lists['tasks'].addEventListener('click', e => {
    if (e.target.closest('#refreshTasksBtn'))    doFetch();
    if (e.target.closest('#syncAllToNotionBtn')) doSyncAllToNotion();
});
els.lists['due-soon'].addEventListener('click', e => {
    if (e.target.closest('#refreshDueSoonBtn')) doFetch();
});
els.lists['files'].addEventListener('click', e => {
    if (e.target.closest('#refreshFilesBtn') || e.target.closest('#fetchFilesEmptyBtn')) doFetchFilesOnly();
});

// — File warning dismiss —
els.dismissFileWarningBtn.addEventListener('click', () => {
    if (els.dismissFileWarning.checked) {
        State.dismissedFileWarning = true;
        chrome.storage.local.set({ dismissedFileWarning: true });
    }
    els.fileWarning.classList.add('hidden');
    els.fetchFilesInitialBtn.classList.remove('hidden');
});

// ============================================================
// Module Selector Modal
// ============================================================

els.selectAllModules.addEventListener('change', (e) => {
    document.querySelectorAll('.module-checkbox').forEach(cb => cb.checked = e.target.checked);
});

function closeModal() {
    els.moduleSelectorModal.classList.remove('visible');
    if (State._modalFocusTrapCleanup) { State._modalFocusTrapCleanup(); State._modalFocusTrapCleanup = null; }
}

els.cancelModuleBtn.addEventListener('click', () => {
    closeModal();
    showToast('Fetch cancelled', 'info', 2000);
});

els.scanModulesBtn.addEventListener('click', async () => {
    closeModal();

    const selectedIndices = Array.from(document.querySelectorAll('.module-checkbox:checked'))
        .map(cb => parseInt(cb.value));

    if (selectedIndices.length === 0) { showToast('No modules selected', 'error'); return; }

    const targetLinks = selectedIndices.map(i => State.pendingModuleLinks[i]);

    els.statusMessage.classList.add('hidden');
    els.lists['files'].classList.remove('hidden');
    renderLoadingState(els.lists['files'], 'Starting scan...');

    const allFiles = [];

    try {
        for (let i = 0; i < targetLinks.length; i++) {
            const link = targetLinks[i];
            updateLoadingProgress(`Fetching ${link.title} (${i + 1} of ${targetLinks.length})`, i + 1, targetLinks.length);

            try {
                const response = await fetch(link.url);
                const text     = await response.text();
                const doc      = new DOMParser().parseFromString(text, 'text/html');
                const found    = findFilesOnPage(doc, State.pendingSubject, link.title, link.url);
                if (found?.length) allFiles.push(...found);
            } catch (err) {
                Logger.error(`Error fetching lesson files ${link.title}:`, err);
            }
        }

        if (allFiles.length === 0) {
            showToast('No files found in selected modules', 'info');
            if (State.files.length > 0) renderFiles();
            else {
                els.lists['files'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
                els.emptyTitle.textContent = 'No files found';
                els.statusText.textContent = 'No downloadable files in selected modules.';
            }
        } else {
            State.files.push(...allFiles);
            saveAndRenderFiles();
            showToast(`Found ${allFiles.length} files`, 'success');
        }
    } catch (err) {
        Logger.error('Batch Scrape Error:', err);
        showToast('Error scanning modules', 'error');
    } finally {
        resetFileFetchButtons();
    }
});

// ============================================================
// Notion — OAuth & Sync
// ============================================================

function doConnectNotion() {
    els.connectNotionBtn.disabled = true;
    els.connectNotionBtn.textContent = 'Connecting…';
    showToast('Opening Notion authorization…', 'info', 2000);

    const onResult = (request) => {
        if (request.action !== 'notionConnectResult') return;
        chrome.runtime.onMessage.removeListener(onResult);

        if (request.success) {
            State.notionConnected = true;
            renderNotionSettings(true, request.workspaceName, request.dbUrl || '');
            updateActionBar();
            showToast('Connected to Notion!', 'success');
        } else {
            showToast(request.error || 'Connection failed. Try again.', 'error');
        }
        els.connectNotionBtn.disabled = false;
        els.connectNotionBtn.textContent = 'Connect with Notion';
    };
    chrome.runtime.onMessage.addListener(onResult);

    // Wake the service worker first, then start OAuth once it's ready.
    chrome.runtime.sendMessage({ action: 'ping' }, () => {
        void chrome.runtime.lastError;
        setTimeout(() => chrome.runtime.sendMessage({ action: 'notionConnect' }), 500);
    });
}

async function doSyncAllToNotion() {
    const items = await chrome.storage.local.get(['notionToken', 'notionDatabaseId', 'notionSyncedIds']);
    if (!items.notionToken || !items.notionDatabaseId) {
        showToast('Connect to Notion first', 'error');
        openSettings();
        return;
    }

    const activeTasks = State.tasks.filter(t => !State.completedTaskIds.has(t.id));
    if (!activeTasks.length) { showToast('No tasks to sync', 'info'); return; }

    const syncedIds = new Set(items.notionSyncedIds || []);
    if (activeTasks.every(t => syncedIds.has(t.id))) {
        showToast('All tasks already in Notion', 'info');
        return;
    }

    const btn = document.getElementById('syncAllToNotionBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }

    try {
        const results = await sendTasks(items.notionToken, items.notionDatabaseId, activeTasks, syncedIds);
        await chrome.storage.local.set({ notionSyncedIds: [...syncedIds] });

        const skipNote = results.skipped > 0 ? `, ${results.skipped} already synced` : '';
        if (results.created > 0) showToast(`${results.created} task${results.created !== 1 ? 's' : ''} sent to Notion${skipNote}`, 'success');
        if (results.failed > 0)  showToast(`${results.failed} failed to send`, 'error');

    } catch (err) {
        Logger.error('Sync all error:', err);
        showToast('Sync failed', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Sync All'; }
    }
}

function doDisconnectNotion() {
    chrome.storage.local.remove(['notionToken', 'notionDatabaseId', 'notionWorkspaceName'], () => {
        State.notionConnected = false;
        renderNotionSettings(false);
        updateActionBar();
        showToast('Disconnected from Notion', 'info');
    });
}

async function doSendToNotion() {
    const items = await chrome.storage.local.get(['notionToken', 'notionDatabaseId', 'notionSyncedIds']);
    if (!items.notionToken || !items.notionDatabaseId) {
        showToast('Connect to Notion first', 'error');
        openSettings();
        return;
    }

    const selectedTasks = [...State.selectedIds]
        .map(id => State.tasks.find(t => t.id === id))
        .filter(Boolean);
    if (!selectedTasks.length) { showToast('No tasks selected', 'error'); return; }

    const syncedIds = new Set(items.notionSyncedIds || []);
    els.sendToNotionBtn.disabled = true;
    els.sendToNotionBtn.textContent = 'Sending…';

    try {
        const results = await sendTasks(items.notionToken, items.notionDatabaseId, selectedTasks, syncedIds);
        await chrome.storage.local.set({ notionSyncedIds: [...syncedIds] });

        if (results.created > 0) {
            const skipNote = results.skipped > 0 ? `, ${results.skipped} already synced` : '';
            showToast(`${results.created} task${results.created !== 1 ? 's' : ''} sent to Notion${skipNote}`, 'success');
        } else if (results.skipped > 0) {
            showToast('All selected tasks already in Notion', 'info');
        }
        if (results.failed > 0) showToast(`${results.failed} task${results.failed !== 1 ? 's' : ''} failed to send`, 'error');

    } catch (err) {
        Logger.error('Send to Notion error:', err);
        showToast('Failed to send to Notion', 'error');
    } finally {
        els.sendToNotionBtn.disabled = false;
        els.sendToNotionBtn.textContent = 'Send to Notion';
    }
}

// ============================================================
// Boot
// ============================================================

document.addEventListener('DOMContentLoaded', loadCache);
