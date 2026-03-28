// ==========================================
// actions.js - Side Effects, Event Wiring & Boot
// ==========================================
// Globals available from classic script tags in popup.html:
//   Logger            (logger.js)
//   scrapeWidgetLinks, parseSubjectPage, findFilesOnPage,
//   scrapeSubjectName, scrapeSidebarModules, cleanSubject, hashStr  (scraper.js)

import { State } from './state.js';
import {
    els, getEl, showToast, renderSkeletons, renderTasks, renderFiles,
    attachCheckboxListeners, updateActionBar, switchTab,
    openSettings, closeSettings, updateNotionSettingsVisibility,
    updateExportDropdown, toggleDarkMode, showFileWarningIfNeeded,
    parseDate, updateBadge, applyTheme, isOnSubjectPage,
    updateSubjectFilterOptions,
} from './ui.js';

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

/**
 * Reads the DLSU-D To-Do widget from the active tab, then hands off
 * the full fetch/parse loop to the background service worker.
 * The popup can be closed mid-scan — results are saved to storage
 * and picked up by chrome.storage.onChanged when the scan completes.
 */
async function doFetch() {
    if (isFetching) return;
    isFetching = true;

    els.statusMessage.classList.add('hidden');
    els.lists['tasks'].classList.remove('hidden');
    renderSkeletons(els.lists['tasks'], 5);

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
            isFetching = false;
            return;
        }

        const results = await safeScriptExecute(tab.id, { func: scrapeWidgetLinks }, 'widget scrape');
        if (!results) {
            showScriptError('widget scrape', 'tasks');
            els.fetchInitialBtn.classList.remove('hidden');
            isFetching = false;
            return;
        }

        if (!results[0] || !results[0].result) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'No widget found';
            els.statusText.textContent = 'No To-Do widget found on this page.';
            els.fetchInitialBtn.classList.remove('hidden');
            isFetching = false;
            return;
        }

        const subjectLinks = results[0].result;

        if (subjectLinks.length === 0) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'All caught up';
            els.statusText.textContent = 'To-Do widget empty. No tasks found.';
            els.fetchInitialBtn.classList.remove('hidden');
            isFetching = false;
            return;
        }

        showToast(`Found ${subjectLinks.length} subjects. Scanning...`, 'info', 2000);

        // Listen for the background scan to write its results to storage.
        const onScanComplete = (changes, area) => {
            if (area !== 'local' || !changes.lastScrape) return;
            chrome.storage.onChanged.removeListener(onScanComplete);

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
            isFetching = false;
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
        isFetching = false;
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
    isFetching = true;

    els.statusMessage.classList.add('hidden');
    els.lists['files'].classList.remove('hidden');
    renderSkeletons(els.lists['files'], 4);

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith('https://dlsud.edu20.org') && !tab.url.startsWith('http://dlsud.edu20.org'))) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = 'Wrong page';
            els.statusText.textContent = 'File fetching only works on subject pages. Navigate to a subject\'s module page and try again.';
            isFetching = false;
            return;
        }

        if (!isOnSubjectPage(tab.url)) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.fileWarning.classList.remove('hidden');
            els.fetchFilesInitialBtn.classList.add('hidden');
            els.emptyTitle.textContent = 'No files yet';
            els.statusText.textContent = 'Navigate to a subject page and fetch files';
            isFetching = false;
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
            if (State.files.length > 0) renderFiles();
            else {
                els.lists['files'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
            }
            isFetching = false;
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
        isFetching = false;
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
        ['lastScrape', 'notionToken', 'notionDbId', 'dismissedFileWarning',
         'completedTaskIds', 'notionSyncEnabled', 'darkMode'],
        (items) => {
            if (items.notionToken) els.apiKey.value = items.notionToken;
            if (items.notionDbId)  els.dbId.value   = items.notionDbId;
            State.dismissedFileWarning = items.dismissedFileWarning || false;
            State.notionSyncEnabled    = items.notionSyncEnabled    || false;
            els.notionSyncToggle.checked = State.notionSyncEnabled;
            updateExportDropdown();

            if (items.completedTaskIds && Array.isArray(items.completedTaskIds)) {
                State.completedTaskIds = new Set(items.completedTaskIds);
            }

            if (items.darkMode) {
                State.darkMode = items.darkMode;
                applyTheme(State.darkMode);
                els.darkMode.checked = true;
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
                els.statusText.textContent = 'Open your dashboard and fetch your assignments';
                showFileWarningIfNeeded();
            } else {
                els.statusMessage.classList.remove('hidden');
                els.taskControls.classList.add('hidden');
                els.emptyTitle.textContent = 'Welcome to UDScraper';
                els.statusText.textContent = 'Open your dashboard and fetch your assignments';
                showFileWarningIfNeeded();
            }
        }
    );
}

// ============================================================
// Dropdown Toggle Helper
// ============================================================

/** Toggles one dropdown open while closing all others. */
function toggleDropdown(dropdown) {
    const isHidden = dropdown.classList.contains('hidden');
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
    if (isHidden) dropdown.classList.remove('hidden');
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

getEl('notionTutorialToggle').addEventListener('click', () => {
    const panel   = getEl('notionTutorial');
    const toggle  = getEl('notionTutorialToggle');
    const isOpen  = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.classList.toggle('open', !isOpen);
});

els.saveKeysBtn.addEventListener('click', () => {
    const token = els.apiKey.value.trim();
    const dbId  = els.dbId.value.trim();
    if (!token || !dbId) { showToast('Please fill in both fields', 'error'); return; }
    chrome.storage.local.set({ notionToken: token, notionDbId: dbId }, () => {
        showToast('Credentials saved', 'success');
        els.settingsStatus.textContent = '';
    });
});

els.clearDataBtn.addEventListener('click', () => {
    if (!confirm('This will clear all cached tasks, files, and credentials. Continue?')) return;
    chrome.storage.local.clear(() => {
        State.tasks = [];
        State.files = [];
        State.selectedIds.clear();
        State.completedTaskIds.clear();
        State.searchQuery   = '';
        State.subjectFilter = '';
        State.sortBy        = 'dueDate';
        State.notionSyncEnabled = false;
        els.apiKey.value                = '';
        els.dbId.value                  = '';
        els.notionSyncToggle.checked    = false;
        updateExportDropdown();
        els.lists['tasks'].innerHTML    = '';
        els.lists['due-soon'].innerHTML = '';
        els.lists['files'].innerHTML    = '';
        els.dueBadge.classList.add('hidden');
        els.taskControls.classList.add('hidden');
        els.taskSearch.value            = '';
        els.subjectFilterLabel.textContent = 'All Subjects';
        els.sortSelectLabel.textContent    = 'Due Date';
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = 'Welcome to UDScraper';
        els.statusText.textContent = 'Open your dashboard and fetch your assignments';
        els.fetchInitialBtn.classList.remove('hidden');
        updateActionBar();
        closeSettings();
        showToast('All data cleared', 'info');
        chrome.runtime.sendMessage({ action: 'updateBadge', count: 0, hasOverdue: false });
    });
});

els.darkMode.addEventListener('change', (e) => toggleDarkMode(e.target.checked));

els.notionSyncToggle.addEventListener('change', (e) => {
    State.notionSyncEnabled = e.target.checked;
    chrome.storage.local.set({ notionSyncEnabled: e.target.checked });
    updateNotionSettingsVisibility();
    updateExportDropdown();
    showToast(State.notionSyncEnabled ? 'Notion sync enabled' : 'Notion sync disabled',
              State.notionSyncEnabled ? 'success' : 'info');
});

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

    if (format === 'notion') {
        const items = await new Promise(r => chrome.storage.local.get(['notionToken', 'notionDbId'], r));
        if (!items.notionToken || !items.notionDbId) {
            showToast('Set Notion credentials in Settings first', 'error');
            return;
        }

        els.exportBtn.disabled    = true;
        els.exportBtn.textContent = 'Sending...';
        els.progressFill.style.width = '0%';

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'sendToNotion',
                    tasks:  selectedTasks,
                    token:  items.notionToken,
                    dbId:   items.notionDbId,
                }, (resp) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(resp);
                });
            });

            els.progressFill.style.width = '100%';
            if (response?.success) {
                showToast(`${selectedTasks.length} tasks sent to Notion`, 'success');
                State.selectedIds.clear();
                document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
                updateActionBar();
            } else {
                showToast(response?.message || 'Export failed', 'error');
            }
        } catch (err) {
            Logger.error('Export error:', err);
            showToast('Export failed. Check console for details.', 'error');
        } finally {
            els.exportBtn.disabled    = false;
            els.exportBtn.textContent = 'Export';
            setTimeout(() => { els.progressFill.style.width = '0%'; }, 1000);
        }

    } else if (format === 'text') {
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

// — Search (debounced) —
let searchDebounceTimer;
els.taskSearch.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        State.searchQuery = e.target.value;
        if (State.tasks.length > 0) renderTasks();
    }, 150);
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
    if (e.target.closest('#refreshTasksBtn')) doFetch();
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

els.cancelModuleBtn.addEventListener('click', () => {
    els.moduleSelectorModal.classList.remove('visible');
    showToast('Fetch cancelled', 'info', 2000);
});

els.scanModulesBtn.addEventListener('click', async () => {
    els.moduleSelectorModal.classList.remove('visible');

    const selectedIndices = Array.from(document.querySelectorAll('.module-checkbox:checked'))
        .map(cb => parseInt(cb.value));

    if (selectedIndices.length === 0) { showToast('No modules selected', 'error'); return; }

    const targetLinks = selectedIndices.map(i => State.pendingModuleLinks[i]);

    // Show progress strip above skeletons
    els.statusMessage.classList.add('hidden');
    els.lists['files'].classList.remove('hidden');
    renderSkeletons(els.lists['files'], 4);

    const statusBar = document.createElement('div');
    statusBar.id = 'scan-status';
    statusBar.className = 'scan-status';

    const statusText = document.createElement('span');
    statusText.id = 'scan-status-text';
    statusText.textContent = 'Starting scan…';

    const barWrap = document.createElement('div');
    barWrap.className = 'scan-bar';
    const barFill = document.createElement('div');
    barFill.id = 'scan-bar-fill';
    barFill.className = 'scan-bar-fill';
    barWrap.appendChild(barFill);

    statusBar.append(statusText, barWrap);
    els.lists['files'].insertAdjacentElement('afterbegin', statusBar);

    const allFiles = [];

    try {
        for (let i = 0; i < targetLinks.length; i++) {
            const link = targetLinks[i];
            const pct  = Math.round(((i + 1) / targetLinks.length) * 100);
            statusText.textContent = `${i + 1} / ${targetLinks.length} — ${link.title}`;
            barFill.style.width = `${pct}%`;

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
// Boot
// ============================================================

document.addEventListener('DOMContentLoaded', loadCache);
