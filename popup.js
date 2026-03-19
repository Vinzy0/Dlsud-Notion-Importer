const State = {
    tasks: [],
    files: [],
    selectedIds: new Set(),
    activeTab: 'tasks',
    dismissedFileWarning: false,
    currentTabUrl: '',
    darkMode: false,
    notionSyncEnabled: false,
    completedTaskIds: new Set(),
    searchQuery: '',
    subjectFilter: '',
    sortBy: 'dueDate'
};

// --- Curated subject color palette for dark mode ---
const SUBJECT_PALETTE = [
    { bg: 'rgba(99,102,241,0.18)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    { bg: 'rgba(236,72,153,0.18)',  text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
    { bg: 'rgba(52,211,153,0.18)',  text: '#6ee7b7', border: 'rgba(52,211,153,0.3)' },
    { bg: 'rgba(251,146,60,0.18)', text: '#fdba74', border: 'rgba(251,146,60,0.3)' },
    { bg: 'rgba(96,165,250,0.18)', text: '#93bbfd', border: 'rgba(96,165,250,0.3)' },
    { bg: 'rgba(163,230,53,0.18)', text: '#bef264', border: 'rgba(163,230,53,0.3)' },
    { bg: 'rgba(248,113,113,0.18)', text: '#fca5a5', border: 'rgba(248,113,113,0.3)' },
    { bg: 'rgba(45,212,191,0.18)', text: '#5eead4', border: 'rgba(45,212,191,0.3)' },
    { bg: 'rgba(251,191,36,0.18)', text: '#fde68a', border: 'rgba(251,191,36,0.3)' },
    { bg: 'rgba(192,132,252,0.18)', text: '#d8b4fe', border: 'rgba(192,132,252,0.3)' },
    { bg: 'rgba(34,211,238,0.18)', text: '#67e8f9', border: 'rgba(34,211,238,0.3)' },
    { bg: 'rgba(244,114,182,0.18)', text: '#f9a8d4', border: 'rgba(244,114,182,0.3)' },
];

// SVG icon templates
const ICONS = {
    check: '<svg class="check-icon" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    externalLink: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10"/><path d="M9 2h5v5"/><path d="M14 2L7 9"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M3 12h10"/></svg>',
    toastSuccess: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5.5 8l2 2 3-3.5"/></svg>',
    toastError: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4"/></svg>',
    toastInfo: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v4"/><circle cx="8" cy="5" r="0.5" fill="currentColor"/></svg>',
};

// UI Elements - with defensive DOM access via getEl helper
function getEl(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`[UDScraper] Missing DOM element: #${id}`);
    return el;
}

const els = {
    settingsBtn: getEl('settingsBtn'),
    closeSettingsBtn: getEl('closeSettingsBtn'),
    settingsPanel: getEl('settings-panel'),
    settingsBackdrop: getEl('settings-backdrop'),
    tabBar: document.querySelector('.tab-bar'),
    tabIndicator: getEl('tab-indicator'),
    tabs: document.querySelectorAll('.tab'),
    dueBadge: getEl('due-badge'),
    statusMessage: getEl('status-message'),
    statusText: getEl('status-text'),
    emptyTitle: getEl('empty-title'),
    fetchInitialBtn: getEl('fetchInitialBtn'),
    fetchFilesInitialBtn: getEl('fetchFilesInitialBtn'),
    fileWarning: getEl('fileWarning'),
    dismissFileWarning: getEl('dismissFileWarning'),
    dismissFileWarningBtn: getEl('dismissFileWarningBtn'),
    lists: {
        'tasks': getEl('tasks-list'),
        'due-soon': getEl('due-soon-list'),
        'files': getEl('files-list')
    },
    actionBar: getEl('action-bar'),
    selectedCount: getEl('selected-count'),
    closeActionsBtn: getEl('closeActionsBtn'),
    exportBtn: getEl('exportBtn'),
    exportSelect: getEl('exportSelect'),
    progressFill: getEl('progress-fill'),
    toastContainer: getEl('toast-container'),

    // Settings
    saveKeysBtn: getEl('saveKeysBtn'),
    clearDataBtn: getEl('clearDataBtn'),
    apiKey: getEl('apiKey'),
    dbId: getEl('dbId'),
    settingsStatus: getEl('settings-status'),
    darkMode: getEl('darkMode'),
    notionSyncToggle: getEl('notionSyncToggle'),
    notionCredentialsSection: getEl('notionCredentialsSection'),

    // Task Controls
    taskControls: getEl('task-controls'),
    taskSearch: getEl('taskSearch'),
    subjectFilterBtn: getEl('subjectFilterBtn'),
    subjectFilterLabel: getEl('subjectFilterLabel'),
    subjectFilterDropdown: getEl('subjectFilterDropdown'),
    sortSelectBtn: getEl('sortSelectBtn'),
    sortSelectLabel: getEl('sortSelectLabel'),
    sortSelectDropdown: getEl('sortSelectDropdown'),

    // Modal
    moduleSelectorModal: getEl('moduleSelectorModal'),
    moduleList: getEl('moduleList'),
    selectAllModules: getEl('selectAllModules'),
    cancelModuleBtn: getEl('cancelModuleBtn'),
    scanModulesBtn: getEl('scanModulesBtn')
};

// ============================================================
// Toast Notification System
// ============================================================

function showToast(message, type = 'info', duration = 3000) {
    const iconMap = { success: ICONS.toastSuccess, error: ICONS.toastError, info: ICONS.toastInfo };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${iconMap[type] || iconMap.info}<span>${message}</span>`;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ============================================================
// Page Detection
// ============================================================

function isOnSubjectPage(url) {
    if (!url) return false;
    if (url.includes('/student_lesson/show/')) return true;
    if (url === 'https://dlsud.edu20.org/' || url === 'http://dlsud.edu20.org/') return false;
    if (url.match(/^https?:\/\/dlsud\.edu20\.org\/home(\/|$)/i)) return false;
    if (url.match(/^https?:\/\/dlsud\.edu20\.org\/home_news(\/|$)/i)) return false;
    if (url.match(/^https?:\/\/dlsud\.edu20\.org\/?$/)) return false;
    return true;
}

async function showFileWarningIfNeeded() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    State.currentTabUrl = tab?.url || '';
    
    const isFilesTab = State.activeTab === 'files';
    const isHomePage = !isOnSubjectPage(State.currentTabUrl);
    const hasFiles = State.files.length > 0;
    const showWarning = isFilesTab && isHomePage && !State.dismissedFileWarning && !hasFiles;
    
    if (showWarning) {
        els.fileWarning.classList.remove('hidden');
        els.fetchFilesInitialBtn.classList.add('hidden');
        els.emptyTitle.textContent = "No files yet";
        els.statusText.textContent = "Navigate to a subject page and fetch files";
    } else {
        els.fileWarning.classList.add('hidden');
        if (hasFiles) {
            els.fetchFilesInitialBtn.classList.add('hidden');
        } else {
            els.fetchFilesInitialBtn.classList.remove('hidden');
        }
    }
}

// ============================================================
// Skeleton Loading
// ============================================================

function renderSkeletons(container, count = 5) {
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

/** Escapes a string for safe insertion into HTML. */
function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

/** Strips garbage patterns from raw subject strings scraped from the LMS. */
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
    // If the parsed date is more than ~6 months in the past, it's probably next year.
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

    if (diffDays < 0) return { label: 'OVERDUE', class: 'urgency-overdue', urgency: 'overdue' };
    if (diffDays === 0) return { label: 'TODAY', class: 'urgency-today', urgency: 'today' };
    if (diffDays === 1) return { label: 'TOMORROW', class: 'urgency-tomorrow', urgency: 'tomorrow' };
    if (diffDays <= 3) return { label: `${diffDays}d left`, class: 'urgency-soon', urgency: 'soon' };
    if (diffDays <= 7) return { label: `${diffDays} days`, class: '', urgency: '' };
    return { label: dateStr, class: '', urgency: '' };
}

function getSubjectColor(subject) {
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SUBJECT_PALETTE[Math.abs(hash) % SUBJECT_PALETTE.length];
}

function getFileTypeClass(ext) {
    if (ext === 'pdf') return 'pdf';
    if (ext === 'ppt' || ext === 'pptx') return 'ppt';
    if (ext === 'doc' || ext === 'docx') return 'doc';
    if (ext === 'xls' || ext === 'xlsx') return 'xls';
    if (ext === 'zip') return 'zip';
    if (['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(ext)) return 'img';
    return 'default';
}

// ============================================================
// Rendering
// ============================================================

const REFRESH_ICON = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1v5h5"/><path d="M3.51 10a6 6 0 1 0 .49-5L1 6"/></svg>`;

function renderTasks() {
    els.taskControls.classList.remove('hidden');

    const taskCount = State.tasks.length;
    const taskToolbar = `
        <div class="list-top-header">
            <div class="checkbox-wrapper select-all-wrapper">
                <input type="checkbox" id="selectAllTasks">
                <div class="checkbox-custom">
                    <svg class="check-icon" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
            </div>
            <span>${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
            <button class="secondary-btn small list-refresh-btn" id="refreshTasksBtn">${REFRESH_ICON} Refresh</button>
        </div>
        <hr class="files-divider">
    `;
    els.lists['tasks'].innerHTML = taskToolbar;
    els.lists['due-soon'].innerHTML = taskToolbar.replace('id="refreshTasksBtn"', 'id="refreshDueSoonBtn"');

    const filteredTasks = State.tasks.filter(task => {
        const matchesSearch = !State.searchQuery || 
            task.name.toLowerCase().includes(State.searchQuery.toLowerCase());
        const matchesSubject = !State.subjectFilter || 
            task.subject === State.subjectFilter;
        return matchesSearch && matchesSubject;
    });

    const activeTasks = filteredTasks.filter(t => !State.completedTaskIds.has(t.id));
    const completedTasks = filteredTasks.filter(t => State.completedTaskIds.has(t.id));

    const sortTasks = (tasks) => {
        return [...tasks].sort((a, b) => {
            if (State.sortBy === 'dueDate') {
                const da = parseDate(a.date);
                const db = parseDate(b.date);
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;
                return da - db;
            } else if (State.sortBy === 'subject') {
                return a.subject.localeCompare(b.subject);
            } else if (State.sortBy === 'name') {
                return a.name.localeCompare(b.name);
            }
            return 0;
        });
    };

    const sortedActive = sortTasks(activeTasks);
    const sortedCompleted = sortTasks(completedTasks);

    let dueSoonCount = 0;

    sortedActive.forEach((task, index) => {
        const urgency = getUrgencyInfo(task.date);
        const color = getSubjectColor(task.subject);
        const d = parseDate(task.date);

        let isDueSoon = false;
        if (d) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const target = new Date(d);
            target.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) isDueSoon = true;
        }

        const urgencyAttr = urgency.urgency ? `data-urgency="${urgency.urgency}"` : '';
        const urgencyBadge = urgency.class
            ? `<span class="urgency-badge ${urgency.class}">${urgency.label}</span>`
            : `<span class="due-text">${urgency.label}</span>`;

        const rowHTML = `
            <div class="task-row" ${urgencyAttr} style="animation-delay:${Math.min(index * 40, 200)}ms">
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${State.selectedIds.has(task.id) ? 'checked' : ''}>
                    <span class="checkbox-custom">${ICONS.check}</span>
                </label>
                <div class="task-info">
                    <span class="task-name" title="${esc(task.name)}">${esc(task.name)}</span>
                    <div class="task-meta">
                        <span class="subject-pill" style="background:${color.bg}; color:${color.text}; border:1px solid ${color.border}">${esc(task.subject)}</span>
                        ${urgencyBadge}
                    </div>
                </div>
                <a href="${esc(task.link)}" target="_blank" class="task-link" title="Open Task">${ICONS.externalLink}</a>
            </div>
        `;

        els.lists['tasks'].insertAdjacentHTML('beforeend', rowHTML);

        if (isDueSoon) {
            dueSoonCount++;
            els.lists['due-soon'].insertAdjacentHTML('beforeend', rowHTML);
        }
    });

    if (sortedCompleted.length > 0) {
        els.lists['tasks'].insertAdjacentHTML('beforeend', `
            <div class="task-section-divider">Completed (${sortedCompleted.length})</div>
        `);
        
        sortedCompleted.forEach((task, index) => {
            const urgency = getUrgencyInfo(task.date);
            const color = getSubjectColor(task.subject);
            const d = parseDate(task.date);

            let isDueSoon = false;
            if (d) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const target = new Date(d);
                target.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
                if (diffDays <= 3) isDueSoon = true;
            }

            const urgencyAttr = urgency.urgency ? `data-urgency="${urgency.urgency}"` : '';
            const urgencyBadge = urgency.class
                ? `<span class="urgency-badge ${urgency.class}">${urgency.label}</span>`
                : `<span class="due-text">${urgency.label}</span>`;

            const rowHTML = `
                <div class="task-row task-done" ${urgencyAttr} style="animation-delay:${Math.min(index * 40, 200)}ms">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" class="task-checkbox" data-id="${task.id}" checked>
                        <span class="checkbox-custom">${ICONS.check}</span>
                    </label>
                    <div class="task-info">
                        <span class="task-name" title="${esc(task.name)}">${esc(task.name)}</span>
                        <div class="task-meta">
                            <span class="subject-pill" style="background:${color.bg}; color:${color.text}; border:1px solid ${color.border}">${esc(task.subject)}</span>
                            ${urgencyBadge}
                        </div>
                    </div>
                    <a href="${esc(task.link)}" target="_blank" class="task-link" title="Open Task">${ICONS.externalLink}</a>
                </div>
            `;

            els.lists['tasks'].insertAdjacentHTML('beforeend', rowHTML);
        });
    }

    if (dueSoonCount > 0) {
        els.dueBadge.textContent = dueSoonCount;
        els.dueBadge.classList.remove('hidden');
    } else {
        els.dueBadge.classList.add('hidden');
        els.lists['due-soon'].innerHTML = `
            <div class="empty-state" style="margin-top: 40px;">
                <div class="empty-illustration">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="18" stroke="#5a5f73" stroke-width="2" fill="none"/>
                        <path d="M16 24l5 5 11-11" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <p class="empty-title">All clear</p>
                <p class="empty-desc">Nothing due in the next 3 days</p>
            </div>
        `;
    }

    updateSubjectFilterOptions();
    attachCheckboxListeners();
    updateActionBar();
}

function updateSubjectFilterOptions() {
    const subjects = [...new Set(State.tasks.map(t => t.subject))].sort();
    
    let optionsHtml = `<div class="custom-select-option ${!State.subjectFilter ? 'selected' : ''}" data-value="">All Subjects</div>`;
    subjects.forEach(s => {
        optionsHtml += `<div class="custom-select-option ${State.subjectFilter === s ? 'selected' : ''}" data-value="${esc(s)}">${esc(s)}</div>`;
    });
    
    els.subjectFilterDropdown.innerHTML = optionsHtml;
    
    if (State.subjectFilter && subjects.includes(State.subjectFilter)) {
        els.subjectFilterLabel.textContent = State.subjectFilter;
    } else {
        els.subjectFilterLabel.textContent = 'All Subjects';
        State.subjectFilter = '';
    }
}

function renderFiles() {
    els.lists['files'].innerHTML = '';

    if (!State.files || State.files.length === 0) {
        els.lists['files'].innerHTML = `
            <div class="empty-state" style="margin-top: 40px;">
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
            </div>
        `;
        return;
    }

    const filesBySubject = State.files.reduce((acc, file) => {
        if (!acc[file.subject]) acc[file.subject] = [];
        acc[file.subject].push(file);
        return acc;
    }, {});

    let filesHTML = `
        <div class="files-top-header">
            <span>Files (${State.files.length})</span>
            <div class="files-header-actions">
                <button class="secondary-btn small list-refresh-btn" id="refreshFilesBtn">${REFRESH_ICON} Fetch More</button>
                <button class="danger-btn small" id="clearFilesBtn">Clear</button>
            </div>
        </div>
        <hr class="files-divider">
    `;

    let fileIndex = 0;

    for (const [subject, files] of Object.entries(filesBySubject)) {
        const color = getSubjectColor(subject);
        filesHTML += `
            <div class="subject-file-group">
                <div class="subject-file-header">
                    <span class="subject-pill" style="background:${color.bg}; color:${color.text}; border:1px solid ${color.border}">${esc(subject)}</span>
                </div>
        `;

        files.forEach(file => {
            const typeClass = getFileTypeClass(file.extension);
            filesHTML += `
                <div class="file-row" style="animation-delay:${Math.min(fileIndex * 40, 200)}ms">
                    <div class="file-type-icon ${typeClass}">${esc((file.extension || 'FILE').toUpperCase())}</div>
                    <div class="file-details">
                        <span class="file-name" title="${esc(file.filename)}">${esc(file.filename)}</span>
                        <div class="file-meta-row">
                            <span class="file-url">${esc(file.url.replace(/^https?:\/\//, '').split('?')[0])}</span>
                            <span class="file-task">from: ${esc(file.taskName)}</span>
                        </div>
                    </div>
                    <button class="download-btn download-single-btn" data-url="${esc(file.url)}" data-filename="${esc(file.filename)}" title="Download">
                        ${ICONS.download}
                    </button>
                </div>
            `;
            fileIndex++;
        });

        filesHTML += `</div>`;
    }

    els.lists['files'].innerHTML = filesHTML;

    // Attach File Listeners
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
            let target = e.target.closest('button');
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

function toggleTaskComplete(taskId) {
    if (State.completedTaskIds.has(taskId)) {
        State.completedTaskIds.delete(taskId);
    } else {
        State.completedTaskIds.add(taskId);
    }
    persistCompletedTasks();
    renderTasks();
}

function persistCompletedTasks() {
    chrome.storage.local.set({ completedTaskIds: [...State.completedTaskIds] });
}

// ============================================================
// Selection & Action Bar
// ============================================================

function attachCheckboxListeners() {
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            
            if (e.target.checked) {
                State.selectedIds.add(id);
            } else {
                State.selectedIds.delete(id);
            }

            document.querySelectorAll(`.task-checkbox[data-id="${id}"]`).forEach(box => {
                box.checked = e.target.checked;
            });

            updateActionBar();
        });

        cb.addEventListener('dblclick', (e) => {
            const id = e.target.dataset.id;
            toggleTaskComplete(id);
        });
    });

    document.querySelectorAll('#selectAllTasks').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const checked = e.target.checked;
            State.tasks.forEach(task => {
                if (checked) State.selectedIds.add(task.id);
                else State.selectedIds.delete(task.id);
            });
            document.querySelectorAll('.task-checkbox').forEach(cb => {
                cb.checked = checked;
            });
            updateActionBar();
        });
    });
}

function updateActionBar() {
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

function switchTab(tabId) {
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
            els.emptyTitle.textContent = "No files yet";
            els.statusText.textContent = "Navigate to a subject page and fetch files";
            showFileWarningIfNeeded();
        } else {
            els.fetchInitialBtn.classList.remove('hidden');
            els.fetchFilesInitialBtn.classList.add('hidden');
            els.fileWarning.classList.add('hidden');
            els.emptyTitle.textContent = "No tasks yet";
            els.statusText.textContent = "Open your dashboard and fetch your assignments";
        }
    }

    // Animate indicator - segmented control calculation
    const index = Array.from(els.tabs).indexOf(targetTab);
    const tabBarWidth = els.tabBar.offsetWidth;
    const tabWidth = (tabBarWidth - 16 - 4) / 3; // padding (8+8) and gaps (2+2)
    els.tabIndicator.style.transform = `translateX(${index * (tabWidth + 2)}px)`;
}

els.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ============================================================
// Settings
// ============================================================

function openSettings() {
    updateNotionSettingsVisibility();
    els.settingsPanel.classList.add('open');
    els.settingsBackdrop.classList.add('visible');
}

function updateNotionSettingsVisibility() {
    if (State.notionSyncEnabled) {
        els.notionCredentialsSection.classList.remove('hidden');
    } else {
        els.notionCredentialsSection.classList.add('hidden');
    }
}

function updateExportDropdown() {
    const notionOption = els.exportSelect.querySelector('option[value="notion"]');
    if (notionOption) {
        notionOption.style.display = State.notionSyncEnabled ? '' : 'none';
    }
    if (!State.notionSyncEnabled && els.exportSelect.value === 'notion') {
        els.exportSelect.value = 'text';
    }
}

function closeSettings() {
    els.settingsPanel.classList.remove('open');
    els.settingsBackdrop.classList.remove('visible');
}

els.settingsBtn.addEventListener('click', openSettings);
els.closeSettingsBtn.addEventListener('click', closeSettings);
els.settingsBackdrop.addEventListener('click', closeSettings);

// Save Credentials
els.saveKeysBtn.addEventListener('click', () => {
    const token = els.apiKey.value.trim();
    const dbId = els.dbId.value.trim();

    if (!token || !dbId) {
        showToast('Please fill in both fields', 'error');
        return;
    }

    chrome.storage.local.set({ notionToken: token, notionDbId: dbId }, () => {
        showToast('Credentials saved', 'success');
        els.settingsStatus.textContent = '';
    });
});

// Clear All Data
els.clearDataBtn.addEventListener('click', () => {
    if (!confirm('This will clear all cached tasks, files, and credentials. Continue?')) return;

    chrome.storage.local.clear(() => {
        State.tasks = [];
        State.files = [];
        State.selectedIds.clear();
        State.completedTaskIds.clear();
        State.searchQuery = '';
        State.subjectFilter = '';
        State.sortBy = 'dueDate';
        State.notionSyncEnabled = false;
        els.apiKey.value = '';
        els.dbId.value = '';
        els.notionSyncToggle.checked = false;
        updateExportDropdown();
        els.lists['tasks'].innerHTML = '';
        els.lists['due-soon'].innerHTML = '';
        els.lists['files'].innerHTML = '';
        els.dueBadge.classList.add('hidden');
        els.taskControls.classList.add('hidden');
        els.taskSearch.value = '';
        els.subjectFilterLabel.textContent = 'All Subjects';
        els.sortSelectLabel.textContent = 'Due Date';
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = "Welcome to UDScraper";
        els.statusText.textContent = "Open your dashboard and fetch your assignments";
        els.fetchInitialBtn.classList.remove('hidden');
        updateActionBar();
        closeSettings();
        showToast('All data cleared', 'info');
        
        chrome.runtime.sendMessage({
            action: 'updateBadge',
            count: 0,
            hasOverdue: false
        });
    });
});

// Dark Mode Toggle
els.darkMode.addEventListener('change', (e) => {
    toggleDarkMode(e.target.checked);
});

// Notion Sync Toggle
els.notionSyncToggle.addEventListener('change', (e) => {
    State.notionSyncEnabled = e.target.checked;
    chrome.storage.local.set({ notionSyncEnabled: e.target.checked });
    updateNotionSettingsVisibility();
    updateExportDropdown();
    if (!State.notionSyncEnabled) {
        showToast('Notion sync disabled', 'info');
    } else {
        showToast('Notion sync enabled', 'success');
    }
});

// Close Actions
els.closeActionsBtn.addEventListener('click', () => {
    State.selectedIds.clear();
    document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('#selectAllTasks').forEach(cb => cb.checked = false);
    updateActionBar();
});

// ============================================================
// Export Handler
// ============================================================

els.exportBtn.addEventListener('click', async () => {
    const format = els.exportSelect.value;
    const selectedTasks = [...State.selectedIds].map(id => State.tasks.find(t => t.id === id)).filter(Boolean);

    if (selectedTasks.length === 0) {
        showToast('No tasks selected', 'error');
        return;
    }

    if (format === 'notion') {
        // Check credentials
        const items = await new Promise(r => chrome.storage.local.get(['notionToken', 'notionDbId'], r));
        if (!items.notionToken || !items.notionDbId) {
            showToast('Set Notion credentials in Settings first', 'error');
            return;
        }

        els.exportBtn.disabled = true;
        els.exportBtn.textContent = 'Sending...';
        els.progressFill.style.width = '0%';

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'sendToNotion',
                    tasks: selectedTasks,
                    token: items.notionToken,
                    dbId: items.notionDbId
                }, (resp) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(resp);
                });
            });

            els.progressFill.style.width = '100%';

            if (response && response.success) {
                showToast(`${selectedTasks.length} tasks sent to Notion`, 'success');
                State.selectedIds.clear();
                document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
                updateActionBar();
            } else {
                const msg = response?.message || 'Export failed';
                showToast(msg, 'error');
            }
        } catch (err) {
            console.error('Export error:', err);
            showToast('Export failed. Check console for details.', 'error');
        } finally {
            els.exportBtn.disabled = false;
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
        const csvCell = s => `"${(s || '').replace(/"/g, '""')}"`;
        const header = 'Subject,Task,Due Date,Link';
        const rows = selectedTasks.map(t => [csvCell(t.subject), csvCell(t.name), csvCell(t.date), csvCell(t.link)].join(','));
        await navigator.clipboard.writeText([header, ...rows].join('\n'));
        showToast('Copied as CSV', 'success');
    }
});

// ============================================================
// Fetch Logic
// ============================================================

els.fetchInitialBtn.addEventListener('click', doFetch);
els.fetchFilesInitialBtn.addEventListener('click', doFetchFilesOnly);

let searchDebounceTimer;
els.taskSearch.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        State.searchQuery = e.target.value;
        if (State.tasks.length > 0) renderTasks();
    }, 150);
});

function toggleDropdown(dropdown) {
    const isHidden = dropdown.classList.contains('hidden');
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
    if (isHidden) {
        dropdown.classList.remove('hidden');
    }
}

els.subjectFilterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(els.subjectFilterDropdown);
    els.sortSelectDropdown.classList.add('hidden');
});

els.sortSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(els.sortSelectDropdown);
    els.subjectFilterDropdown.classList.add('hidden');
});

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
});

els.subjectFilterDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (!option) return;
    
    const value = option.dataset.value;
    const label = option.textContent;
    
    State.subjectFilter = value;
    els.subjectFilterLabel.textContent = label;
    els.subjectFilterDropdown.classList.add('hidden');
    
    document.querySelectorAll('#subjectFilterDropdown .custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    if (State.tasks.length > 0) renderTasks();
});

els.sortSelectDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (!option) return;
    
    const value = option.dataset.value;
    const label = option.textContent;
    
    State.sortBy = value;
    els.sortSelectLabel.textContent = label;
    els.sortSelectDropdown.classList.add('hidden');
    
    document.querySelectorAll('#sortSelectDropdown .custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    if (State.tasks.length > 0) renderTasks();
});

// ============================================================
// Keyboard Shortcuts
// ============================================================

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (els.settingsPanel.classList.contains('open')) return;
    
    if (e.key.toLowerCase() === 'r') {
        doFetch();
    } else if (e.key.toLowerCase() === 's') {
        openSettings();
    }
});

// Delegate clicks on dynamically-rendered refresh buttons inside each list.
els.lists['tasks'].addEventListener('click', e => { if (e.target.closest('#refreshTasksBtn')) doFetch(); });
els.lists['due-soon'].addEventListener('click', e => { if (e.target.closest('#refreshDueSoonBtn')) doFetch(); });
els.lists['files'].addEventListener('click', e => {
    if (e.target.closest('#refreshFilesBtn') || e.target.closest('#fetchFilesEmptyBtn')) doFetchFilesOnly();
});

els.dismissFileWarningBtn.addEventListener('click', () => {
    if (els.dismissFileWarning.checked) {
        State.dismissedFileWarning = true;
        chrome.storage.local.set({ dismissedFileWarning: true });
    }
    els.fileWarning.classList.add('hidden');
    els.fetchFilesInitialBtn.classList.remove('hidden');
});

async function safeScriptExecute(tabId, options, errorKey) {
    try {
        return await chrome.scripting.executeScript({ target: { tabId }, ...options });
    } catch (err) {
        console.error(`[UDScraper] Script execution failed (${errorKey}):`, err);
        return null;
    }
}

const SCRIPT_ERROR_MESSAGES = {
    'scraper injection': { title: "Error", text: "Could not load page scanner. Try reloading the extension." },
    'widget scrape': { title: "Error", text: "Could not read tasks. Try refreshing the page." },
    'context fetch': { title: "Error", text: "Could not read page content. Try refreshing the page." },
    'module scan': { title: "Error", text: "Could not scan for modules. Try refreshing the page." },
    'file scan': { title: "Error", text: "Could not scan for files. Try refreshing the page." }
};

function showScriptError(errorKey, listId) {
    const msg = SCRIPT_ERROR_MESSAGES[errorKey] || { title: "Error", text: "Script execution failed. Try refreshing the page." };
    if (listId) {
        els.lists[listId]?.classList.add('hidden');
    }
    els.statusMessage.classList.remove('hidden');
    els.emptyTitle.textContent = msg.title;
    els.statusText.textContent = msg.text;
    showToast(msg.text, 'error');
}

let isFetching = false;

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
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith("https://dlsud.edu20.org") && !tab.url.startsWith("http://dlsud.edu20.org"))) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "Wrong page";
            els.statusText.textContent = "Please go to your dashboard first.";
            els.fetchInitialBtn.classList.remove('hidden');
            return;
        }

        const results = await safeScriptExecute(tab.id, { func: scrapeWidgetLinks }, 'widget scrape');
        if (!results) {
            showScriptError('widget scrape', 'tasks');
            els.fetchInitialBtn.classList.remove('hidden');
            return;
        }

        if (!results[0] || !results[0].result) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "No widget found";
            els.statusText.textContent = "No To-Do widget found on this page.";
            els.fetchInitialBtn.classList.remove('hidden');
            return;
        }

        const subjectLinks = results[0].result;

        if (subjectLinks.length === 0) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "All caught up";
            els.statusText.textContent = "To-Do widget empty. No tasks found.";
            els.fetchInitialBtn.classList.remove('hidden');
            return;
        }

        showToast(`Found ${subjectLinks.length} subjects. Scanning...`, 'info', 2000);

        const allTasks = [];
        const allFiles = [];

        const parser = new DOMParser();

        for (const link of subjectLinks) {
            try {
                const response = await fetch(link.url);
                const text = await response.text();
                const doc = parser.parseFromString(text, "text/html");

                const tasks = parseSubjectPage(doc, cleanSubject(link.subject), link.url);
                allTasks.push(...tasks);

                const taskPageResults = await Promise.all(
                    tasks
                        .filter(task => task.link && task.link !== link.url)
                        .map(task =>
                            fetch(task.link)
                                .then(r => r.text())
                                .then(html => {
                                    const taskDoc = parser.parseFromString(html, "text/html");
                                    return findFilesOnPage(taskDoc, task.subject, task.name, task.link);
                                })
                                .catch(e => {
                                    console.error(`Error finding files on task ${task.name}:`, e);
                                    return [];
                                })
                        )
                );
                taskPageResults.forEach(files => allFiles.push(...files));
            } catch (err) {
                console.error(`Error fetching ${link.subject}:`, err);
            }
        }

        const uniqueTasks = [...new Map(allTasks.map(t => [t.id, t])).values()];

        if (uniqueTasks.length === 0) {
            els.lists['tasks'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "All caught up";
            els.statusText.textContent = "No pending tasks found.";
            els.fetchInitialBtn.classList.remove('hidden');
        } else {
            const cache = {
                timestamp: Date.now(),
                tasks: uniqueTasks,
                files: allFiles
            };
            chrome.storage.local.set({ lastScrape: cache }, () => {
                loadCache();
                updateBadge();
            });
            showToast(`Found ${uniqueTasks.length} tasks${allFiles.length > 0 ? ` and ${allFiles.length} files` : ''}`, 'success');
        }
    } catch (err) {
        console.error("Scrape Error:", err);
        els.lists['tasks'].classList.add('hidden');
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = "Error";
        els.statusText.textContent = "Error scanning. Check your connection.";
        els.fetchInitialBtn.classList.remove('hidden');
        showToast('Scan failed', 'error');
    } finally {
        isFetching = false;
    }
}

async function doFetchFilesOnly() {
    if (isFetching) return;
    isFetching = true;

    els.statusMessage.classList.add('hidden');
    els.lists['files'].classList.remove('hidden');
    renderSkeletons(els.lists['files'], 4);

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith("https://dlsud.edu20.org") && !tab.url.startsWith("http://dlsud.edu20.org"))) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "Wrong page";
            els.statusText.textContent = "File fetching only works on subject pages. Navigate to a subject's module page and try again.";
            return;
        }

        if (!isOnSubjectPage(tab.url)) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.fileWarning.classList.remove('hidden');
            els.fetchFilesInitialBtn.classList.add('hidden');
            els.emptyTitle.textContent = "No files yet";
            els.statusText.textContent = "Navigate to a subject page and fetch files";
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
                subject: scrapeSubjectName(),
                sidebarLinks: scrapeSidebarModules() || [],
                currentHref: location.href,
                currentTitle: document.title
            })
        }, 'context fetch');
        if (!results) {
            showScriptError('context fetch', 'files');
            resetFileFetchButtons();
            return;
        }

        if (!results[0] || !results[0].result) throw new Error("Could not parse page context.");

        const context = results[0].result;

        if (context.sidebarLinks && context.sidebarLinks.length > 0) {
            State.pendingModuleLinks = context.sidebarLinks;
            State.pendingSubject = cleanSubject(context.subject);

            els.moduleList.innerHTML = context.sidebarLinks.map((link, i) => `
                <div class="module-item">
                    <input type="checkbox" id="mod-${i}" class="module-checkbox" value="${i}" checked>
                    <label for="mod-${i}" title="${esc(link.title)}">${esc(link.title)}</label>
                </div>
            `).join('');

            els.moduleSelectorModal.classList.add('visible');

            if (State.files.length > 0) renderFiles();
            else {
                els.lists['files'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
            }
            return;
        }

        showToast('No modules found. Scanning current page...', 'info', 2000);

        const fileResults = await safeScriptExecute(tab.id, {
            func: (subj, taskName, sourceUrl) => findFilesOnPage(document, subj, taskName, sourceUrl),
            args: [context.subject, context.currentTitle || "Current Page", context.currentHref]
        }, 'file scan');
        if (!fileResults) {
            showScriptError('file scan', 'files');
            resetFileFetchButtons();
            return;
        }

        if (!fileResults[0] || !fileResults[0].result || fileResults[0].result.length === 0) {
            els.lists['files'].classList.add('hidden');
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "No files found";
            els.statusText.textContent = "No downloadable files found on this page.";
            resetFileFetchButtons();
            return;
        }

        const newFiles = fileResults[0].result;

        State.files.push(...newFiles);
        saveAndRenderFiles();
        resetFileFetchButtons();
        showToast(`Found ${newFiles.length} files`, 'success');

    } catch (err) {
        console.error("Scrape Files Error:", err);
        els.lists['files'].classList.add('hidden');
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = "Error";
        els.statusText.textContent = "Error scanning page.";
        resetFileFetchButtons();
        showToast('File scan failed', 'error');
    } finally {
        isFetching = false;
    }
}

function resetFileFetchButtons() {
    els.fetchFilesInitialBtn.disabled = false;
    if (State.files.length === 0) {
        els.fetchFilesInitialBtn.classList.remove('hidden');
    }
}

function saveAndRenderFiles() {
    // Read existing cache first so we never overwrite tasks with an empty array
    // when the user has only fetched files (not tasks) in this session.
    chrome.storage.local.get(['lastScrape'], (items) => {
        const existing = items.lastScrape || {};
        const cache = {
            timestamp: Date.now(),
            tasks: State.tasks.length > 0 ? State.tasks : (existing.tasks || []),
            files: State.files
        };
        chrome.storage.local.set({ lastScrape: cache }, () => {
            loadCache();
        });
    });
}

// ============================================================
// Modal Action Listeners
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

    const checkboxes = document.querySelectorAll('.module-checkbox:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (selectedIndices.length === 0) {
        showToast('No modules selected', 'error');
        return;
    }

    const targetLinks = selectedIndices.map(i => State.pendingModuleLinks[i]);

    // Show loading state with an inline progress strip above the skeletons.
    els.statusMessage.classList.add('hidden');
    els.lists['files'].classList.remove('hidden');
    renderSkeletons(els.lists['files'], 4);
    els.lists['files'].insertAdjacentHTML('afterbegin', `
        <div id="scan-status" class="scan-status">
            <span id="scan-status-text">Starting scan…</span>
            <div class="scan-bar"><div id="scan-bar-fill" class="scan-bar-fill"></div></div>
        </div>
    `);

    const allFiles = [];

    try {
        for (let i = 0; i < targetLinks.length; i++) {
            const link = targetLinks[i];
            const pct = Math.round(((i + 1) / targetLinks.length) * 100);
            const statusText = getEl('scan-status-text');
            const barFill    = getEl('scan-bar-fill');
            if (statusText) statusText.textContent = `${i + 1} / ${targetLinks.length} — ${link.title}`;
            if (barFill)    barFill.style.width = `${pct}%`;

            try {
                const response = await fetch(link.url);
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/html");

                const filesDesc = findFilesOnPage(doc, State.pendingSubject, link.title, link.url);
                if (filesDesc && filesDesc.length > 0) {
                    allFiles.push(...filesDesc);
                }
            } catch (err) {
                console.error(`Error fetching lesson files ${link.title}:`, err);
            }
        }

        if (allFiles.length === 0) {
            showToast('No files found in selected modules', 'info');
            if (State.files.length > 0) {
                renderFiles();
            } else {
                els.lists['files'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
                els.emptyTitle.textContent = "No files found";
                els.statusText.textContent = "No downloadable files in selected modules.";
            }
        } else {
            State.files.push(...allFiles);
            saveAndRenderFiles();
            showToast(`Found ${allFiles.length} files`, 'success');
        }
    } catch (err) {
        console.error("Batch Scrape Error:", err);
        showToast('Error scanning modules', 'error');
    } finally {
        resetFileFetchButtons();
    }
});

// ============================================================
// Boot & Cache
// ============================================================

function loadCache() {
    chrome.storage.local.get(['lastScrape', 'notionToken', 'notionDbId', 'dismissedFileWarning', 'completedTaskIds', 'notionSyncEnabled'], (items) => {
        if (items.notionToken) els.apiKey.value = items.notionToken;
        if (items.notionDbId) els.dbId.value = items.notionDbId;
        State.dismissedFileWarning = items.dismissedFileWarning || false;
        State.notionSyncEnabled = items.notionSyncEnabled || false;
        els.notionSyncToggle.checked = State.notionSyncEnabled;
        updateExportDropdown();

        if (items.completedTaskIds && Array.isArray(items.completedTaskIds)) {
            State.completedTaskIds = new Set(items.completedTaskIds);
        }

        const cache = items.lastScrape;
        const AUTO_REFRESH_MS = 12 * 60 * 60 * 1000;
        
        if (cache && cache.tasks && cache.tasks.length > 0) {
            State.tasks = cache.tasks.map(t => t.id ? t : { ...t, id: hashStr(t.subject + t.name + t.link) });
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
                const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
            });

            switchTab(dueSoonItems.length > 0 ? 'due-soon' : 'tasks');

            if (cache.timestamp && Date.now() - cache.timestamp > AUTO_REFRESH_MS) {
                doFetch();
            }

        } else if (cache && cache.files && cache.files.length > 0) {
            State.files = cache.files;
            renderFiles();
            els.statusMessage.classList.remove('hidden');
            els.taskControls.classList.add('hidden');
            els.emptyTitle.textContent = "No tasks yet";
            els.statusText.textContent = "Open your dashboard and fetch your assignments";
            showFileWarningIfNeeded();
        } else {
            els.statusMessage.classList.remove('hidden');
            els.taskControls.classList.add('hidden');
            els.emptyTitle.textContent = "Welcome to UDScraper";
            els.statusText.textContent = "Open your dashboard and fetch your assignments";
            showFileWarningIfNeeded();
        }

        if (items.darkMode) {
            State.darkMode = items.darkMode;
            applyTheme(State.darkMode);
            els.darkMode.checked = true;
        }
    });
}

function updateBadge() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let overdueCount = 0;
    let todayCount = 0;

    State.tasks.forEach(task => {
        if (State.completedTaskIds.has(task.id)) return;
        const d = parseDate(task.date);
        if (!d) return;
        const target = new Date(d);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) overdueCount++;
        else if (diffDays === 0) todayCount++;
    });

    const total = overdueCount + todayCount;
    
    chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: total,
        hasOverdue: overdueCount > 0
    });
}

// ============================================================
// Theme Management
// ============================================================

function applyTheme(isDark) {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function toggleDarkMode(enabled) {
    State.darkMode = enabled;
    applyTheme(enabled);
    chrome.storage.local.set({ darkMode: enabled });
}

document.addEventListener('DOMContentLoaded', loadCache);
