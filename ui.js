// ==========================================
// ui.js - DOM Rendering & Display Logic
// ==========================================
// Globals available from classic script tags in popup.html:
//   Logger       (logger.js)
//   hashStr, parseSubjectPage, findFilesOnPage, scrapeWidgetLinks,
//   scrapeSubjectName, scrapeSidebarModules, cleanSubject  (scraper.js)

import { State, SUBJECT_PALETTE, ICONS, REFRESH_ICON } from './state.js';

// ============================================================
// DOM Helpers
// ============================================================

/**
 * Retrieves a DOM element by ID. Logs a warning if missing.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function getEl(id) {
    const el = document.getElementById(id);
    if (!el) Logger.warn(`Missing DOM element: #${id}`);
    return el;
}

/** Cached references to all popup DOM elements. */
export const els = {
    settingsBtn:              getEl('settingsBtn'),
    closeSettingsBtn:         getEl('closeSettingsBtn'),
    settingsPanel:            getEl('settings-panel'),
    settingsBackdrop:         getEl('settings-backdrop'),
    tabBar:                   document.querySelector('.tab-bar'),
    tabIndicator:             getEl('tab-indicator'),
    tabs:                     document.querySelectorAll('.tab'),
    dueBadge:                 getEl('due-badge'),
    statusMessage:            getEl('status-message'),
    statusText:               getEl('status-text'),
    emptyTitle:               getEl('empty-title'),
    fetchInitialBtn:          getEl('fetchInitialBtn'),
    fetchFilesInitialBtn:     getEl('fetchFilesInitialBtn'),
    fileWarning:              getEl('fileWarning'),
    dismissFileWarning:       getEl('dismissFileWarning'),
    dismissFileWarningBtn:    getEl('dismissFileWarningBtn'),
    lists: {
        'tasks':    getEl('tasks-list'),
        'due-soon': getEl('due-soon-list'),
        'files':    getEl('files-list'),
    },
    actionBar:                getEl('action-bar'),
    selectedCount:            getEl('selected-count'),
    closeActionsBtn:          getEl('closeActionsBtn'),
    exportBtn:                getEl('exportBtn'),
    exportSelect:             getEl('exportSelect'),
    progressFill:             getEl('progress-fill'),
    toastContainer:           getEl('toast-container'),

    // Settings
    saveKeysBtn:              getEl('saveKeysBtn'),
    clearDataBtn:             getEl('clearDataBtn'),
    apiKey:                   getEl('apiKey'),
    dbId:                     getEl('dbId'),
    settingsStatus:           getEl('settings-status'),
    darkMode:                 getEl('darkMode'),
    notionSyncToggle:         getEl('notionSyncToggle'),
    notionCredentialsSection: getEl('notionCredentialsSection'),

    // Task Controls
    taskControls:             getEl('task-controls'),
    taskSearch:               getEl('taskSearch'),
    subjectFilterBtn:         getEl('subjectFilterBtn'),
    subjectFilterLabel:       getEl('subjectFilterLabel'),
    subjectFilterDropdown:    getEl('subjectFilterDropdown'),
    sortSelectBtn:            getEl('sortSelectBtn'),
    sortSelectLabel:          getEl('sortSelectLabel'),
    sortSelectDropdown:       getEl('sortSelectDropdown'),

    // Modal
    moduleSelectorModal:      getEl('moduleSelectorModal'),
    moduleList:               getEl('moduleList'),
    selectAllModules:         getEl('selectAllModules'),
    cancelModuleBtn:          getEl('cancelModuleBtn'),
    scanModulesBtn:           getEl('scanModulesBtn'),
};

// ============================================================
// Toast Notifications
// ============================================================

/**
 * Displays a self-dismissing toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=3000] - Auto-dismiss delay in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
    const iconMap = { success: ICONS.toastSuccess, error: ICONS.toastError, info: ICONS.toastInfo };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.innerHTML = iconMap[type] || iconMap.info; // trusted constant SVG

    const text = document.createElement('span');
    text.textContent = message;

    toast.append(icon, text);
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

/**
 * Renders placeholder skeleton rows while real data loads.
 * @param {HTMLElement} container
 * @param {number} [count=5]
 */
export function renderSkeletons(container, count = 5) {
    container.innerHTML = Array.from({ length: count }, (_, i) =>
        `<div class="skeleton-row" style="animation-delay:${i * 60}ms; margin-bottom: 2px;">
            <div class="skeleton-block skeleton-checkbox"></div>
            <div style="flex:1">
                <div class="skeleton-block skeleton-line-long"></div>
                <div class="skeleton-block skeleton-line-short"></div>
            </div>
        </div>`
    ).join('');
}

// ============================================================
// Utilities
// ============================================================

/**
 * Parses a raw LMS date string into a Date object.
 * Returns null for non-date strings or unparseable input.
 * Applies a 6-month heuristic to handle year roll-over.
 * @param {string|null} rawString - e.g. "Mar 28" or "No Due Date"
 * @returns {Date|null}
 */
export function parseDate(rawString) {
    if (!rawString || rawString === 'No Due Date' || rawString === 'Check Link') return null;
    const match = rawString.match(/^[A-Z][a-z]{2}\s\d+/);
    if (!match) return null;
    const currentYear = new Date().getFullYear();
    const d = new Date(`${match[0]} ${currentYear}`);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    if (now - d > 180 * 24 * 60 * 60 * 1000) d.setFullYear(d.getFullYear() + 1);
    return d;
}

/**
 * Returns a display label and CSS class for a given date string
 * relative to today (OVERDUE, TODAY, TOMORROW, Nd left, raw date, etc.).
 * @param {string|null} dateStr
 * @returns {{ label: string, class: string, urgency: string }}
 */
export function getUrgencyInfo(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return { label: dateStr || 'No date', class: '', urgency: '' };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0)   return { label: 'OVERDUE',          class: 'urgency-overdue',   urgency: 'overdue'   };
    if (diffDays === 0) return { label: 'TODAY',             class: 'urgency-today',     urgency: 'today'     };
    if (diffDays === 1) return { label: 'TOMORROW',          class: 'urgency-tomorrow',  urgency: 'tomorrow'  };
    if (diffDays <= 3)  return { label: `${diffDays}d left`, class: 'urgency-soon',      urgency: 'soon'      };
    if (diffDays <= 7)  return { label: `${diffDays} days`,  class: '',                  urgency: ''          };
    return { label: dateStr, class: '', urgency: '' };
}

/**
 * Returns a color palette entry for a given subject, deterministically
 * based on the subject string hash.
 * @param {string} subject
 * @returns {{ bg: string, text: string, border: string }}
 */
export function getSubjectColor(subject) {
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SUBJECT_PALETTE[Math.abs(hash) % SUBJECT_PALETTE.length];
}

/**
 * Maps a file extension to its CSS class for the file-type badge.
 * @param {string} ext - Lowercase extension (e.g. "pdf", "pptx")
 * @returns {string}
 */
export function getFileTypeClass(ext) {
    if (ext === 'pdf') return 'pdf';
    if (ext === 'ppt' || ext === 'pptx') return 'ppt';
    if (ext === 'doc' || ext === 'docx') return 'doc';
    if (ext === 'xls' || ext === 'xlsx') return 'xls';
    if (ext === 'zip') return 'zip';
    if (['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(ext)) return 'img';
    return 'default';
}

// ============================================================
// Task Rendering — Atomic Helpers
// ============================================================

/**
 * Builds the urgency badge element for a task row.
 * Returns a <span> with the appropriate class and text.
 * @param {{ label: string, class: string }} urgency
 * @returns {HTMLSpanElement}
 */
function buildUrgencyBadge(urgency) {
    const badge = document.createElement('span');
    badge.className = urgency.class ? `urgency-badge ${urgency.class}` : 'due-text';
    badge.textContent = urgency.label;
    return badge;
}

/**
 * Builds a single task row DOM element. Uses createElement + textContent
 * throughout to guarantee no XSS from scraped content.
 * @param {{ id: string, name: string, subject: string, date: string, link: string }} task
 * @param {number} index - Position in the rendered list (for animation delay)
 * @param {boolean} isCompleted
 * @returns {HTMLDivElement}
 */
function buildTaskRow(task, index, isCompleted) {
    const urgency = getUrgencyInfo(task.date);
    const color   = getSubjectColor(task.subject);

    const row = document.createElement('div');
    row.className = `task-row${isCompleted ? ' task-done' : ''}`;
    row.style.animationDelay = `${Math.min(index * 40, 200)}ms`;
    if (urgency.urgency) row.dataset.urgency = urgency.urgency;

    // — Checkbox —
    const label = document.createElement('label');
    label.className = 'checkbox-wrapper';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-checkbox';
    cb.dataset.id = task.id;
    if (State.selectedIds.has(task.id) || isCompleted) cb.checked = true;

    const checkIcon = document.createElement('span');
    checkIcon.className = 'checkbox-custom';
    checkIcon.innerHTML = ICONS.check; // trusted constant

    label.append(cb, checkIcon);

    // — Task info —
    const info = document.createElement('div');
    info.className = 'task-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'task-name';
    nameEl.title = task.name;       // setAttribute-safe; no innerHTML
    nameEl.textContent = task.name; // XSS-safe

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const pill = document.createElement('span');
    pill.className = 'subject-pill';
    pill.style.background = color.bg;
    pill.style.color = color.text;
    pill.style.border = `1px solid ${color.border}`;
    pill.textContent = task.subject; // XSS-safe

    meta.append(pill, buildUrgencyBadge(urgency));
    info.append(nameEl, meta);

    // — External link —
    const link = document.createElement('a');
    link.href = task.link;           // browser validates URL
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'task-link';
    link.title = 'Open Task';
    link.innerHTML = ICONS.externalLink; // trusted constant

    row.append(label, info, link);
    return row;
}

/**
 * Returns a copy of the task array sorted according to State.sortBy.
 * @param {Array} tasks
 * @returns {Array}
 */
function sortTaskList(tasks) {
    return [...tasks].sort((a, b) => {
        if (State.sortBy === 'dueDate') {
            const da = parseDate(a.date);
            const db = parseDate(b.date);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return da - db;
        }
        if (State.sortBy === 'subject') return a.subject.localeCompare(b.subject);
        if (State.sortBy === 'name')    return a.name.localeCompare(b.name);
        return 0;
    });
}

/**
 * Returns the "Nothing due" empty-state element for the Due Soon tab.
 * @returns {HTMLDivElement}
 */
function buildDueSoonEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.style.marginTop = '40px';
    wrap.innerHTML = `
        <div class="empty-illustration">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="18" stroke="#5a5f73" stroke-width="2" fill="none"/>
                <path d="M16 24l5 5 11-11" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <p class="empty-title">All clear</p>
        <p class="empty-desc">Nothing due in the next 3 days</p>
    `;
    return wrap;
}

/**
 * Builds the shared toolbar header (checkbox + count + refresh button)
 * for the tasks and due-soon lists.
 * @param {number} taskCount
 * @param {string} refreshBtnId
 * @returns {DocumentFragment}
 */
function buildListToolbar(taskCount, refreshBtnId) {
    const frag = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'list-top-header';

    const cbWrap = document.createElement('div');
    cbWrap.className = 'checkbox-wrapper select-all-wrapper';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.id = 'selectAllTasks';
    const cbCustom = document.createElement('div');
    cbCustom.className = 'checkbox-custom';
    cbCustom.innerHTML = ICONS.check; // trusted constant
    cbWrap.append(selectAll, cbCustom);

    const countSpan = document.createElement('span');
    countSpan.textContent = `${taskCount} task${taskCount !== 1 ? 's' : ''}`;

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'secondary-btn small list-refresh-btn';
    refreshBtn.id = refreshBtnId;
    refreshBtn.innerHTML = REFRESH_ICON + ' Refresh'; // trusted constant + literal text

    header.append(cbWrap, countSpan, refreshBtn);

    const divider = document.createElement('hr');
    divider.className = 'files-divider';

    frag.append(header, divider);
    return frag;
}

// ============================================================
// Task Rendering — Main
// ============================================================

/**
 * Re-renders both the Tasks and Due Soon lists from State,
 * applying current search/filter/sort settings.
 * Calls attachCheckboxListeners() and updateActionBar() when done.
 */
export function renderTasks() {
    els.taskControls.classList.remove('hidden');

    els.lists['tasks'].innerHTML = '';
    els.lists['due-soon'].innerHTML = '';
    els.lists['tasks'].appendChild(buildListToolbar(State.tasks.length, 'refreshTasksBtn'));
    els.lists['due-soon'].appendChild(buildListToolbar(State.tasks.length, 'refreshDueSoonBtn'));

    const filtered = State.tasks.filter(task => {
        const matchesSearch  = !State.searchQuery   || task.name.toLowerCase().includes(State.searchQuery.toLowerCase());
        const matchesSubject = !State.subjectFilter || task.subject === State.subjectFilter;
        return matchesSearch && matchesSubject;
    });

    const activeTasks    = sortTaskList(filtered.filter(t => !State.completedTaskIds.has(t.id)));
    const completedTasks = sortTaskList(filtered.filter(t =>  State.completedTaskIds.has(t.id)));

    let dueSoonCount = 0;

    activeTasks.forEach((task, index) => {
        const row = buildTaskRow(task, index, false);
        els.lists['tasks'].appendChild(row);

        const d = parseDate(task.date);
        if (d) {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const target = new Date(d); target.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) {
                els.lists['due-soon'].appendChild(buildTaskRow(task, dueSoonCount, false));
                dueSoonCount++;
            }
        }
    });

    completedTasks.forEach((task, index) => {
        els.lists['tasks'].appendChild(buildTaskRow(task, index, true));
    });

    if (dueSoonCount > 0) {
        els.dueBadge.textContent = dueSoonCount;
        els.dueBadge.classList.remove('hidden');
    } else {
        els.dueBadge.classList.add('hidden');
        els.lists['due-soon'].appendChild(buildDueSoonEmptyState());
    }

    updateSubjectFilterOptions();
    attachCheckboxListeners();
    updateActionBar();
}

// ============================================================
// Subject Filter
// ============================================================

/** Rebuilds the subject filter dropdown to match the current task list. */
export function updateSubjectFilterOptions() {
    const subjects = [...new Set(State.tasks.map(t => t.subject))].sort();

    els.subjectFilterDropdown.innerHTML = '';

    const allOption = document.createElement('div');
    allOption.className = `custom-select-option${!State.subjectFilter ? ' selected' : ''}`;
    allOption.dataset.value = '';
    allOption.textContent = 'All Subjects';
    els.subjectFilterDropdown.appendChild(allOption);

    subjects.forEach(s => {
        const opt = document.createElement('div');
        opt.className = `custom-select-option${State.subjectFilter === s ? ' selected' : ''}`;
        opt.dataset.value = s;
        opt.textContent = s; // XSS-safe
        els.subjectFilterDropdown.appendChild(opt);
    });

    if (State.subjectFilter && subjects.includes(State.subjectFilter)) {
        els.subjectFilterLabel.textContent = State.subjectFilter;
    } else {
        els.subjectFilterLabel.textContent = 'All Subjects';
        State.subjectFilter = '';
    }
}

// ============================================================
// File Rendering
// ============================================================

/**
 * Builds a single file row DOM element.
 * Uses createElement + textContent to prevent XSS from filenames/URLs.
 * @param {{ filename: string, url: string, extension: string, taskName: string }} file
 * @param {number} index - For animation delay
 * @returns {HTMLDivElement}
 */
function buildFileRow(file, index) {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.style.animationDelay = `${Math.min(index * 40, 200)}ms`;

    const typeIcon = document.createElement('div');
    typeIcon.className = `file-type-icon ${getFileTypeClass(file.extension)}`;
    typeIcon.textContent = (file.extension || 'FILE').toUpperCase(); // XSS-safe

    const details = document.createElement('div');
    details.className = 'file-details';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.title = file.filename;
    name.textContent = file.filename; // XSS-safe

    const metaRow = document.createElement('div');
    metaRow.className = 'file-meta-row';

    const urlSpan = document.createElement('span');
    urlSpan.className = 'file-url';
    urlSpan.textContent = file.url.replace(/^https?:\/\//, '').split('?')[0]; // XSS-safe

    const taskSpan = document.createElement('span');
    taskSpan.className = 'file-task';
    taskSpan.textContent = `from: ${file.taskName}`; // XSS-safe

    metaRow.append(urlSpan, taskSpan);
    details.append(name, metaRow);

    const dlBtn = document.createElement('button');
    dlBtn.className = 'download-btn download-single-btn';
    dlBtn.dataset.url = file.url;
    dlBtn.dataset.filename = file.filename;
    dlBtn.title = 'Download';
    dlBtn.innerHTML = ICONS.download; // trusted constant

    row.append(typeIcon, details, dlBtn);
    return row;
}

/**
 * Re-renders the Files list from State.files.
 * Attaches inline download and clear-files event handlers.
 */
export function renderFiles() {
    els.lists['files'].innerHTML = '';

    if (!State.files || State.files.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.marginTop = '40px';
        empty.innerHTML = `
            <div class="empty-illustration">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <path d="M6 12a2 2 0 012-2h10l4 4h18a2 2 0 012 2v20a2 2 0 01-2 2H8a2 2 0 01-2-2V12z" stroke="#5a5f73" stroke-width="2" fill="none"/>
                    <path d="M20 28h8M24 24v8" stroke="#5a5f73" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <p class="empty-title">No files yet</p>
            <p class="empty-desc">Navigate to a subject page and fetch files</p>
            <button class="primary-btn" id="fetchFilesEmptyBtn">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3v8m0 0l-3-3m3 3l3-3"/>
                    <path d="M3 13h10"/>
                </svg>
                Fetch Files
            </button>
        `;
        els.lists['files'].appendChild(empty);
        return;
    }

    // — Header —
    const header = document.createElement('div');
    header.className = 'files-top-header';

    const countSpan = document.createElement('span');
    countSpan.textContent = `Files (${State.files.length})`;

    const actions = document.createElement('div');
    actions.className = 'files-header-actions';

    const fetchMoreBtn = document.createElement('button');
    fetchMoreBtn.className = 'secondary-btn small list-refresh-btn';
    fetchMoreBtn.id = 'refreshFilesBtn';
    fetchMoreBtn.innerHTML = REFRESH_ICON + ' Fetch More'; // trusted constant

    const clearBtn = document.createElement('button');
    clearBtn.className = 'danger-btn small';
    clearBtn.id = 'clearFilesBtn';
    clearBtn.textContent = 'Clear';

    actions.append(fetchMoreBtn, clearBtn);
    header.append(countSpan, actions);

    const divider = document.createElement('hr');
    divider.className = 'files-divider';

    els.lists['files'].append(header, divider);

    // — Files by subject —
    const filesBySubject = State.files.reduce((acc, file) => {
        if (!acc[file.subject]) acc[file.subject] = [];
        acc[file.subject].push(file);
        return acc;
    }, {});

    let fileIndex = 0;
    for (const [subject, files] of Object.entries(filesBySubject)) {
        const color = getSubjectColor(subject);

        const group = document.createElement('div');
        group.className = 'subject-file-group';

        const groupHeader = document.createElement('div');
        groupHeader.className = 'subject-file-header';

        const pill = document.createElement('span');
        pill.className = 'subject-pill';
        pill.style.background = color.bg;
        pill.style.color = color.text;
        pill.style.border = `1px solid ${color.border}`;
        pill.textContent = subject; // XSS-safe

        groupHeader.appendChild(pill);
        group.appendChild(groupHeader);

        files.forEach(file => {
            group.appendChild(buildFileRow(file, fileIndex++));
        });

        els.lists['files'].appendChild(group);
    }

    // — Event Listeners —
    getEl('clearFilesBtn').addEventListener('click', () => {
        State.files = [];
        chrome.storage.local.get(['lastScrape'], (items) => {
            const cache = items.lastScrape || { tasks: [], files: [] };
            cache.files = [];
            chrome.storage.local.set({ lastScrape: cache }, () => {
                renderFiles();
                showToast('Files cleared', 'info');
            });
        });
    });

    document.querySelectorAll('.download-single-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            const rawName = target.dataset.filename || 'download';
            const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_').trim();
            chrome.downloads.download({ url: target.dataset.url, filename: safeName }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    showToast(`Download failed: ${chrome.runtime.lastError.message}`, 'error');
                } else {
                    showToast(`Downloading ${safeName}`, 'info', 2000);
                }
            });
        });
    });
}

// ============================================================
// Task Completion
// ============================================================

/**
 * Persists the current completedTaskIds set to chrome.storage.
 */
export function persistCompletedTasks() {
    chrome.storage.local.set({ completedTaskIds: [...State.completedTaskIds] });
}

/**
 * Toggles a task between active and completed, then re-renders.
 * @param {string} taskId
 */
export function toggleTaskComplete(taskId) {
    if (State.completedTaskIds.has(taskId)) {
        State.completedTaskIds.delete(taskId);
    } else {
        State.completedTaskIds.add(taskId);
    }
    persistCompletedTasks();
    renderTasks();
}

// ============================================================
// Selection & Action Bar
// ============================================================

/**
 * Wires up checkbox change and double-click listeners on all
 * rendered task rows. Call after each renderTasks().
 */
export function attachCheckboxListeners() {
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) State.selectedIds.add(id);
            else State.selectedIds.delete(id);

            // Sync the same task's checkbox in the other list (tasks / due-soon)
            document.querySelectorAll(`.task-checkbox[data-id="${id}"]`).forEach(box => {
                box.checked = e.target.checked;
            });
            updateActionBar();
        });

        cb.addEventListener('dblclick', (e) => {
            toggleTaskComplete(e.target.dataset.id);
        });
    });

    document.querySelectorAll('#selectAllTasks').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const checked = e.target.checked;
            State.tasks.forEach(task => {
                if (checked) State.selectedIds.add(task.id);
                else State.selectedIds.delete(task.id);
            });
            document.querySelectorAll('.task-checkbox').forEach(box => {
                box.checked = checked;
            });
            updateActionBar();
        });
    });
}

/**
 * Shows or hides the floating action bar based on selection count.
 */
export function updateActionBar() {
    if (State.selectedIds.size > 0) {
        els.actionBar.classList.add('visible');
        els.selectedCount.textContent = `${State.selectedIds.size} selected`;
    } else {
        els.actionBar.classList.remove('visible');
    }
}

// ============================================================
// Tabs
// ============================================================

/**
 * Switches the active tab, updates the animated indicator,
 * and shows/hides the appropriate list and controls.
 * @param {'tasks'|'due-soon'|'files'} tabId
 */
export function switchTab(tabId) {
    els.tabs.forEach(t => t.classList.remove('active'));
    Object.values(els.lists).forEach(l => l.classList.add('hidden'));

    const targetTab = Array.from(els.tabs).find(t => t.dataset.tab === tabId);
    if (!targetTab) return;

    targetTab.classList.add('active');
    els.lists[tabId].classList.remove('hidden');
    State.activeTab = tabId;

    if (tabId === 'files') {
        els.taskControls.classList.add('hidden');
    } else if (State.tasks.length > 0) {
        els.taskControls.classList.remove('hidden');
    }

    const hasData = tabId === 'files' ? State.files.length > 0 : State.tasks.length > 0;

    if (hasData) {
        els.statusMessage.classList.add('hidden');
    } else {
        els.statusMessage.classList.remove('hidden');
        if (tabId === 'files') {
            els.fetchInitialBtn.classList.add('hidden');
            els.fetchFilesInitialBtn.classList.remove('hidden');
            els.emptyTitle.textContent = 'No files yet';
            els.statusText.textContent = 'Navigate to a subject page and fetch files';
            showFileWarningIfNeeded();
        } else {
            els.fetchInitialBtn.classList.remove('hidden');
            els.fetchFilesInitialBtn.classList.add('hidden');
            els.fileWarning.classList.add('hidden');
            els.emptyTitle.textContent = 'No tasks yet';
            els.statusText.textContent = 'Open your dashboard and fetch your assignments';
        }
    }

    // Animate the segmented-control indicator
    const index = Array.from(els.tabs).indexOf(targetTab);
    const tabWidth = (els.tabBar.offsetWidth - 16 - 4) / 3;
    els.tabIndicator.style.transform = `translateX(${index * (tabWidth + 2)}px)`;
}

// ============================================================
// Page Detection
// ============================================================

/**
 * Returns true if the given URL belongs to a DLSU-D subject page
 * (as opposed to the home/dashboard page).
 * @param {string|null} url
 * @returns {boolean}
 */
export function isOnSubjectPage(url) {
    if (!url) return false;
    if (url.includes('/student_lesson/show/')) return true;
    if (url === 'https://dlsud.edu20.org/' || url === 'http://dlsud.edu20.org/') return false;
    if (url.match(/^https?:\/\/dlsud\.edu20\.org\/home(\/|$)/i)) return false;
    if (url.match(/^https?:\/\/dlsud\.edu20\.org\/home_news(\/|$)/i)) return false;
    if (url.match(/^https?:\/\/dlsud\.edu20\.org\/?$/)) return false;
    return true;
}

/**
 * Queries the active tab and shows the "not on subject page" warning
 * when the Files tab is open but no subject page is detected.
 */
export async function showFileWarningIfNeeded() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    State.currentTabUrl = tab?.url || '';

    const showWarning = State.activeTab === 'files'
        && !isOnSubjectPage(State.currentTabUrl)
        && !State.dismissedFileWarning
        && State.files.length === 0;

    if (showWarning) {
        els.fileWarning.classList.remove('hidden');
        els.fetchFilesInitialBtn.classList.add('hidden');
        els.emptyTitle.textContent = 'No files yet';
        els.statusText.textContent = 'Navigate to a subject page and fetch files';
    } else {
        els.fileWarning.classList.add('hidden');
        if (State.files.length > 0) els.fetchFilesInitialBtn.classList.add('hidden');
        else els.fetchFilesInitialBtn.classList.remove('hidden');
    }
}

// ============================================================
// Settings Panel
// ============================================================

/** Shows or hides the Notion credentials section based on sync toggle. */
export function updateNotionSettingsVisibility() {
    if (State.notionSyncEnabled) els.notionCredentialsSection.classList.remove('hidden');
    else els.notionCredentialsSection.classList.add('hidden');
}

/** Hides the Notion export option in the dropdown when sync is off. */
export function updateExportDropdown() {
    const notionOption = els.exportSelect.querySelector('option[value="notion"]');
    if (notionOption) notionOption.style.display = State.notionSyncEnabled ? '' : 'none';
    if (!State.notionSyncEnabled && els.exportSelect.value === 'notion') {
        els.exportSelect.value = 'text';
    }
}

/** Opens the settings panel. */
export function openSettings() {
    updateNotionSettingsVisibility();
    els.settingsPanel.classList.add('open');
    els.settingsBackdrop.classList.add('visible');
}

/** Closes the settings panel. */
export function closeSettings() {
    els.settingsPanel.classList.remove('open');
    els.settingsBackdrop.classList.remove('visible');
}

// ============================================================
// Theme
// ============================================================

/**
 * Sets the data-theme attribute on <body> to apply light or dark CSS vars.
 * @param {boolean} isDark
 */
export function applyTheme(isDark) {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

/**
 * Persists and applies the dark mode preference.
 * @param {boolean} enabled
 */
export function toggleDarkMode(enabled) {
    State.darkMode = enabled;
    applyTheme(enabled);
    chrome.storage.local.set({ darkMode: enabled });
}

// ============================================================
// Badge
// ============================================================

/**
 * Calculates overdue/today task counts from State and tells
 * the background service worker to update the extension badge.
 */
export function updateBadge() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let overdueCount = 0;
    let todayCount   = 0;

    State.tasks.forEach(task => {
        if (State.completedTaskIds.has(task.id)) return;
        const d = parseDate(task.date);
        if (!d) return;
        const target = new Date(d);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0)   overdueCount++;
        else if (diffDays === 0) todayCount++;
    });

    chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: overdueCount + todayCount,
        hasOverdue: overdueCount > 0
    });
}
