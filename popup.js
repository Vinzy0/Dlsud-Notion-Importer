const State = {
    tasks: [],
    files: [],
    selectedIds: new Set(),
    activeTab: 'tasks',
    dismissedFileWarning: false,
    currentTabUrl: '',
    darkMode: false
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

// UI Elements
const els = {
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsBackdrop: document.getElementById('settings-backdrop'),
    tabBar: document.querySelector('.tab-bar'),
    tabIndicator: document.getElementById('tab-indicator'),
    tabs: document.querySelectorAll('.tab'),
    dueBadge: document.getElementById('due-badge'),
    statusMessage: document.getElementById('status-message'),
    statusText: document.getElementById('status-text'),
    emptyTitle: document.getElementById('empty-title'),
    fetchInitialBtn: document.getElementById('fetchInitialBtn'),
    fetchFilesInitialBtn: document.getElementById('fetchFilesInitialBtn'),
    fileWarning: document.getElementById('fileWarning'),
    dismissFileWarning: document.getElementById('dismissFileWarning'),
    dismissFileWarningBtn: document.getElementById('dismissFileWarningBtn'),
    lists: {
        'tasks': document.getElementById('tasks-list'),
        'due-soon': document.getElementById('due-soon-list'),
        'files': document.getElementById('files-list')
    },
    actionBar: document.getElementById('action-bar'),
    selectedCount: document.getElementById('selected-count'),
    closeActionsBtn: document.getElementById('closeActionsBtn'),
    exportBtn: document.getElementById('exportBtn'),
    exportSelect: document.getElementById('exportSelect'),
    progressFill: document.getElementById('progress-fill'),
    toastContainer: document.getElementById('toast-container'),

    // Settings
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    apiKey: document.getElementById('apiKey'),
    dbId: document.getElementById('dbId'),
    settingsStatus: document.getElementById('settings-status'),
    darkMode: document.getElementById('darkMode'),

    // Modal
    moduleSelectorModal: document.getElementById('moduleSelectorModal'),
    moduleList: document.getElementById('moduleList'),
    selectAllModules: document.getElementById('selectAllModules'),
    cancelModuleBtn: document.getElementById('cancelModuleBtn'),
    scanModulesBtn: document.getElementById('scanModulesBtn')
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
    const taskCount = State.tasks.length;
    const taskToolbar = `
        <div class="list-top-header">
            <span>${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
            <button class="secondary-btn small list-refresh-btn" id="refreshTasksBtn">${REFRESH_ICON} Refresh</button>
        </div>
        <hr class="files-divider">
    `;
    els.lists['tasks'].innerHTML = taskToolbar;
    els.lists['due-soon'].innerHTML = taskToolbar.replace('id="refreshTasksBtn"', 'id="refreshDueSoonBtn"');

    const sortedTasks = [...State.tasks].sort((a, b) => {
        const da = parseDate(a.date);
        const db = parseDate(b.date);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
    });

    let dueSoonCount = 0;

    sortedTasks.forEach((task, index) => {
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

    // Handle due soon badge
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

    attachCheckboxListeners();
    updateActionBar();
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
    document.getElementById('clearFilesBtn').addEventListener('click', () => {
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
// Selection & Action Bar
// ============================================================

function attachCheckboxListeners() {
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) State.selectedIds.add(id);
            else State.selectedIds.delete(id);

            // Sync identical checkboxes across tabs (tasks + due-soon share the same task)
            document.querySelectorAll(`.task-checkbox[data-id="${id}"]`).forEach(box => {
                box.checked = e.target.checked;
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

    // Data-driven: always decide whether to show status-message based on
    // whether the active tab actually has data. The old guard
    // (!statusMessage.classList.contains('hidden')) was the bug —
    // it left status-message visible when switching to a loaded files tab.
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
    els.settingsPanel.classList.add('open');
    els.settingsBackdrop.classList.add('visible');
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
        els.apiKey.value = '';
        els.dbId.value = '';
        els.lists['tasks'].innerHTML = '';
        els.lists['due-soon'].innerHTML = '';
        els.lists['files'].innerHTML = '';
        els.dueBadge.classList.add('hidden');
        els.statusMessage.classList.remove('hidden');
        els.emptyTitle.textContent = "No tasks yet";
        els.statusText.textContent = "Open your dashboard and fetch your assignments";
        els.fetchInitialBtn.classList.remove('hidden');
        updateActionBar();
        closeSettings();
        showToast('All data cleared', 'info');
    });
});

// Dark Mode Toggle
els.darkMode.addEventListener('change', (e) => {
    toggleDarkMode(e.target.checked);
});

// Close Actions
els.closeActionsBtn.addEventListener('click', () => {
    State.selectedIds.clear();
    document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
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

async function doFetch() {
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

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeWidgetLinks
        });

        if (!results || !results[0] || !results[0].result) {
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

                // Fetch all task pages in parallel instead of sequentially
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

        // Deduplicate by stable ID — the same task can appear under multiple subjects
        // if the widget lists it more than once.
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
    }
}

async function doFetchFilesOnly() {
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

        // Inject scraper.js into the page so we can call its functions directly,
        // eliminating the duplicated sidebar and file-scan logic.
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scraper.js'] });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
                subject: scrapeSubjectName(),
                sidebarLinks: scrapeSidebarModules() || [],
                currentHref: location.href,
                currentTitle: document.title
            })
        });

        if (!results || !results[0] || !results[0].result) throw new Error("Could not parse page context.");

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

            // Restore file list if we have files
            if (State.files.length > 0) renderFiles();
            else {
                els.lists['files'].classList.add('hidden');
                els.statusMessage.classList.remove('hidden');
            }
            return;
        }

        // Fallback: No Sidebar — scan the current page directly using the injected findFilesOnPage.
        showToast('No modules found. Scanning current page...', 'info', 2000);

        const fileResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (subj, taskName, sourceUrl) => findFilesOnPage(document, subj, taskName, sourceUrl),
            args: [context.subject, context.currentTitle || "Current Page", context.currentHref]
        });

        if (!fileResults || !fileResults[0] || !fileResults[0].result || fileResults[0].result.length === 0) {
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
            const statusText = document.getElementById('scan-status-text');
            const barFill    = document.getElementById('scan-bar-fill');
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
    chrome.storage.local.get(['lastScrape', 'notionToken', 'notionDbId', 'dismissedFileWarning'], (items) => {
        if (items.notionToken) els.apiKey.value = items.notionToken;
        if (items.notionDbId) els.dbId.value = items.notionDbId;
        State.dismissedFileWarning = items.dismissedFileWarning || false;

        const cache = items.lastScrape;
        if (cache && cache.tasks && cache.tasks.length > 0) {
            // Backfill IDs for tasks cached before this field was added.
            State.tasks = cache.tasks.map(t => t.id ? t : { ...t, id: hashStr(t.subject + t.name + t.link) });
            State.files = cache.files || [];

            els.statusMessage.classList.add('hidden');
            renderTasks();
            renderFiles();

            // Determine default tab
            const dueSoonItems = cache.tasks.filter(t => {
                const d = parseDate(t.date);
                if (!d) return false;
                const now = new Date(); now.setHours(0, 0, 0, 0);
                const target = new Date(d); target.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
            });

            switchTab(dueSoonItems.length > 0 ? 'due-soon' : 'tasks');

        } else if (cache && cache.files && cache.files.length > 0) {
            // Has files but no tasks
            State.files = cache.files;
            renderFiles();
            els.statusMessage.classList.remove('hidden');
            els.emptyTitle.textContent = "No tasks yet";
            els.statusText.textContent = "Open your dashboard and fetch your assignments";
            showFileWarningIfNeeded();
        } else {
            // First time or empty
            els.statusMessage.classList.remove('hidden');

            if (!items.notionToken) {
                els.emptyTitle.textContent = "Welcome to UDScraper";
                els.statusText.textContent = "Set up your Notion credentials in Settings, then open your dashboard to get started.";
            } else {
                els.emptyTitle.textContent = "No tasks yet";
                els.statusText.textContent = "Open your dashboard and fetch your assignments";
            }
            
            // Check if we're on files tab and need to show warning
            showFileWarningIfNeeded();
        }

        // Load dark mode preference
        if (items.darkMode) {
            State.darkMode = items.darkMode;
            applyTheme(State.darkMode);
            els.darkMode.checked = true;
        }
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
