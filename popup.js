const State = {
    tasks: [],
    files: [],
    selectedIds: new Set(),
    activeTab: 'tasks'
};

// UI Elements
const els = {
    refreshBtn: document.getElementById('refreshBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsPanel: document.getElementById('settings-panel'),
    tabBar: document.querySelector('.tab-bar'),
    tabIndicator: document.getElementById('tab-indicator'),
    tabs: document.querySelectorAll('.tab'),
    dueBadge: document.getElementById('due-badge'),
    statusMessage: document.getElementById('status-message'),
    statusText: document.getElementById('status-text'),
    fetchInitialBtn: document.getElementById('fetchInitialBtn'),
    fetchFilesInitialBtn: document.getElementById('fetchFilesInitialBtn'),
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

    // Modal Additions
    moduleSelectorModal: document.getElementById('moduleSelectorModal'),
    moduleList: document.getElementById('moduleList'),
    selectAllModules: document.getElementById('selectAllModules'),
    cancelModuleBtn: document.getElementById('cancelModuleBtn'),
    scanModulesBtn: document.getElementById('scanModulesBtn')
};

// --- Utilities ---
function parseDate(rawString) {
    if (!rawString || rawString === "No Due Date" || rawString === "Check Link") return null;

    // Extract Month and Day from formats like "Mar 13"
    const match = rawString.match(/^[A-Z][a-z]{2}\s\d+/);
    if (!match) return null;

    const currentYear = new Date().getFullYear();
    const d = new Date(`${match[0]} ${currentYear}`);
    if (isNaN(d.getTime())) return null;
    return d;
}

function getUrgencyInfo(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return { label: dateStr, class: '' };

    // reset time for date comparison
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'OVERDUE', class: 'today' };
    if (diffDays === 0) return { label: 'TODAY', class: 'today' };
    if (diffDays === 1) return { label: 'TOMORROW', class: 'tomorrow' };
    if (diffDays <= 3) return { label: `${diffDays} days left`, class: 'soon' };
    if (diffDays <= 7) return { label: `${diffDays} days left`, class: '' };

    // > 7 days
    return { label: dateStr, class: '' };
}

function getSubjectColor(subject) {
    // Generate a consistent hex color based on string
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 45%)`;
}

// --- Rendering ---
function renderTasks() {
    els.lists['tasks'].innerHTML = '';
    els.lists['due-soon'].innerHTML = '';

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
        const d = parseDate(task.date);

        // Due within 3 days (inclusive) relative to today
        let isDueSoon = false;
        if (d) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const target = new Date(d);
            target.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 3) isDueSoon = true;
        }

        const rowHTML = `
            <div class="task-row">
                <input type="checkbox" class="task-checkbox" data-index="${index}" ${State.selectedIds.has(index) ? 'checked' : ''}>
                <div class="task-info">
                    <div class="task-header">
                        <span class="subject-pill" style="background-color: ${getSubjectColor(task.subject)}">${task.subject}</span>
                        <span class="task-name" title="${task.name}">${task.name}</span>
                    </div>
                    <div class="task-meta">
                        <span class="due-date ${urgency.class}">${urgency.label}</span>
                        <a href="${task.link}" target="_blank" class="task-link" title="Open Task">→</a>
                    </div>
                </div>
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
        els.dueBadge.classList.remove('hidden');
    } else {
        els.dueBadge.classList.add('hidden');
        els.lists['due-soon'].innerHTML = '<div class="empty-state"><p>Nothing due in the next 3 days ✓</p></div>';
    }

    attachCheckboxListeners();
    updateActionBar();
}

function renderFiles() {
    els.lists['files'].innerHTML = '';

    if (!State.files || State.files.length === 0) {
        els.lists['files'].innerHTML = '<div class="empty-state"><p>No files found. Try fetching tasks.</p></div>';
        return;
    }

    // Group files by subject
    const filesBySubject = State.files.reduce((acc, file) => {
        if (!acc[file.subject]) acc[file.subject] = [];
        acc[file.subject].push(file);
        return acc;
    }, {});

    // Top Level Header
    let filesHTML = `
        <div class="files-top-header">
            <span>Files (${State.files.length})</span>
            <button class="danger-btn small" id="clearFilesBtn" style="padding: 4px 8px; font-size: 11px;">Clear</button>
        </div>
        <hr class="files-divider">
    `;

    for (const [subject, files] of Object.entries(filesBySubject)) {
        filesHTML += `
            <div class="subject-file-group">
                <div class="subject-file-header">
                    <span class="subject-pill" style="background-color: ${getSubjectColor(subject)}">${subject}</span>
                </div>
        `;

        files.forEach(file => {
            let badgeClass = 'default-badge';
            const ext = file.extension;
            if (ext === 'pdf') badgeClass = 'pdf-badge';
            else if (ext === 'ppt' || ext === 'pptx') badgeClass = 'ppt-badge';
            else if (ext === 'doc' || ext === 'docx') badgeClass = 'doc-badge';
            else if (ext === 'xls' || ext === 'xlsx') badgeClass = 'xls-badge';
            else if (ext === 'zip') badgeClass = 'zip-badge';

            filesHTML += `
                <div class="file-row">
                    <div class="file-details">
                        <div class="file-title-row">
                            <span class="file-badge ${badgeClass}">${ext.toUpperCase() || 'FILE'}</span>
                            <span class="file-name" title="${file.filename}">${file.filename}</span>
                        </div>
                        <div class="file-meta-row">
                            <span class="file-url">${file.url.replace(/^https?:\/\//, '').split('?')[0]}</span>
                            <span class="file-task">from: ${file.taskName}</span>
                        </div>
                    </div>
                    <button class="icon-btn download-single-btn" data-url="${file.url}" data-filename="${file.filename}" title="Download">↓</button>
                </div>
            `;
        });

        filesHTML += `</div>`; // end grouping
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
            });
        });
    });

    document.querySelectorAll('.download-single-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let target = e.target;
            // Handle if they clicked the inner span instead of the button itself
            if (target.tagName.toLowerCase() !== 'button') {
                target = target.closest('button');
            }
            chrome.downloads.download({ url: target.dataset.url, filename: target.dataset.filename });
        });
    });
}

// --- Selection & Action Bar ---
function attachCheckboxListeners() {
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            if (e.target.checked) State.selectedIds.add(idx);
            else State.selectedIds.delete(idx);

            // Sync identical checkboxes across tabs
            document.querySelectorAll(`.task-checkbox[data-index="${idx}"]`).forEach(box => {
                box.checked = e.target.checked;
            });

            updateActionBar();
        });
    });
}

function updateActionBar() {
    if (State.selectedIds.size > 0) {
        els.actionBar.classList.remove('hidden');
        els.selectedCount.textContent = `${State.selectedIds.size} selected`;
    } else {
        els.actionBar.classList.add('hidden');
    }
}

// --- Tabs ---
function switchTab(tabId) {
    els.tabs.forEach(t => t.classList.remove('active'));
    Object.values(els.lists).forEach(l => l.classList.add('hidden'));

    const targetTab = Array.from(els.tabs).find(t => t.dataset.tab === tabId);
    if (!targetTab) return;

    targetTab.classList.add('active');
    els.lists[tabId].classList.remove('hidden');
    State.activeTab = tabId;

    // Toggle Empty State Buttons
    if (!els.statusMessage.classList.contains('hidden')) {
        if (tabId === 'files') {
            els.fetchInitialBtn.classList.add('hidden');
            els.fetchFilesInitialBtn.classList.remove('hidden');
            els.statusText.textContent = "No files loaded.";
        } else {
            els.fetchInitialBtn.classList.remove('hidden');
            els.fetchFilesInitialBtn.classList.add('hidden');
            els.statusText.textContent = "No tasks loaded.";
        }
    }

    // Update Header Button Text
    if (tabId === 'files') {
        els.refreshBtn.textContent = "Fetch Page Files";
    } else {
        els.refreshBtn.textContent = "Fetch Tasks";
    }

    // animate indicator
    const index = Array.from(els.tabs).indexOf(targetTab);
    els.tabIndicator.style.transform = `translateX(${index * 100}%)`;
}

els.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// --- Settings ---
els.settingsBtn.addEventListener('click', () => els.settingsPanel.classList.add('open'));
els.closeSettingsBtn.addEventListener('click', () => els.settingsPanel.classList.remove('open'));
els.closeActionsBtn.addEventListener('click', () => {
    State.selectedIds.clear();
    document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
    updateActionBar();
});

// --- Fetch Logic ---
els.refreshBtn.addEventListener('click', () => {
    if (State.activeTab === 'files') doFetchFilesOnly();
    else doFetch();
});
els.fetchInitialBtn.addEventListener('click', doFetch);
els.fetchFilesInitialBtn.addEventListener('click', doFetchFilesOnly);

async function doFetch() {
    els.statusMessage.classList.remove('hidden');
    els.statusText.textContent = "Scanning Dashboard...";
    els.fetchInitialBtn.disabled = true;
    els.fetchInitialBtn.classList.add('hidden');
    els.refreshBtn.classList.add('spinning');
    els.refreshBtn.textContent = "Fetching...";

    // Clear lists while loading
    els.lists['tasks'].innerHTML = '';
    els.lists['due-soon'].innerHTML = '';
    State.tasks = [];
    els.dueBadge.classList.add('hidden');

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith("https://dlsud.edu20.org") && !tab.url.startsWith("http://dlsud.edu20.org"))) {
            els.statusText.textContent = "Please go to the DLSU-D dashboard first.";
            return;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeWidgetLinks
        });

        if (!results || !results[0] || !results[0].result) {
            els.statusText.textContent = "No To-Do widget found on this page.";
            return;
        }

        const subjectLinks = results[0].result;

        if (subjectLinks.length === 0) {
            els.statusText.textContent = "To-Do widget empty. No tasks found.";
            return;
        }

        els.statusText.textContent = `Found ${subjectLinks.length} subjects. Analyzing...`;

        const allTasks = [];
        const allFiles = []; // Phase 2: hold file objects

        for (const link of subjectLinks) {
            els.statusText.textContent = `Checking ${link.subject}...`;
            try {
                // Fetch the list of tasks for the subject
                const response = await fetch(link.url);
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/html");

                const tasks = parseSubjectPage(doc, link.subject, link.url);
                allTasks.push(...tasks);

                // PHASE 2: Fetch File Attachments from each task
                // We have the tasks array, which has property `link` mapping to the task page
                // We only do this for tasks that have a specific URL (not just the subject URL)
                for (const task of tasks) {
                    if (task.link && task.link !== link.url) {
                        try {
                            const taskResponse = await fetch(task.link);
                            const taskText = await taskResponse.text();
                            const taskDoc = parser.parseFromString(taskText, "text/html");

                            const filesDesc = findFilesOnPage(taskDoc, task.subject, task.name, task.link);
                            if (filesDesc && filesDesc.length > 0) {
                                allFiles.push(...filesDesc);
                            }
                        } catch (e) {
                            console.error(`Error finding files on task ${task.name}:`, e);
                        }
                    }
                }

            } catch (err) {
                console.error(`Error fetching ${link.subject}:`, err);
            }
        }

        if (allTasks.length === 0) {
            els.statusText.textContent = "All caught up! No tasks found.";
        } else {
            // Save to cache
            const cache = {
                timestamp: Date.now(),
                tasks: allTasks,
                files: allFiles
            };
            chrome.storage.local.set({ lastScrape: cache }, () => {
                loadCache(); // Re-render from cache
            });
        }
    } catch (err) {
        console.error("Scrape Error:", err);
        els.statusText.textContent = "Error scanning. Please check your connection or permissions.";
    } finally {
        els.fetchInitialBtn.disabled = false;
        els.fetchInitialBtn.classList.remove('hidden');
        els.refreshBtn.classList.remove('spinning');
        els.refreshBtn.textContent = "Fetch Tasks";
    }
}

async function doFetchFilesOnly() {
    els.statusMessage.classList.remove('hidden');
    els.statusText.textContent = "Scanning Current Page...";
    els.fetchFilesInitialBtn.disabled = true;
    els.fetchFilesInitialBtn.classList.add('hidden');
    els.refreshBtn.classList.add('spinning');
    els.refreshBtn.textContent = "Fetching...";

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || (!tab.url.startsWith("https://dlsud.edu20.org") && !tab.url.startsWith("http://dlsud.edu20.org"))) {
            els.statusText.textContent = "Please go to a DLSU-D page first.";
            return;
        }

        // Inject scanner to get context and sidebar links
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                let subject = "Current Subject";
                const headerObj = document.querySelector('header');
                if (headerObj && headerObj.textContent) {
                    const match = headerObj.textContent.match(/([A-Z0-9_\-]+\s+.*)/i);
                    if (match) subject = match[0].split('-')[0].trim();
                    else subject = headerObj.textContent.substring(0, 30).trim();
                }

                // Try capturing the sidebar first
                let sidebarLinks = [];
                const nav = document.querySelector('.section_nav_holder') || document.querySelector('#contentWrap nav');
                if (nav) {
                    const links = nav.querySelectorAll('a[href*="/student_lesson/"], a[href*="/lesson/"]');
                    const seenUrls = new Set();
                    const BASE_URL = "https://dlsud.edu20.org";
                    links.forEach(link => {
                        const href = link.getAttribute('href');
                        if (!href || href === "#" || href.startsWith("javascript:")) return;
                        const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
                        if (seenUrls.has(fullUrl)) return;
                        seenUrls.add(fullUrl);

                        let title = "";
                        const titleSpans = link.querySelectorAll('.evo-module-title');
                        if (titleSpans.length > 0) {
                            title = titleSpans[titleSpans.length - 1].innerText.replace(/[\n\r]+/g, ' ').trim();
                        } else {
                            title = link.innerText.replace(/[\n\r]+/g, ' ').trim();
                        }
                        if (!title) title = "Unnamed Lesson";

                        sidebarLinks.push({ title, url: fullUrl });
                    });
                }

                return { subject, sidebarLinks, currentHref: location.href, currentTitle: document.title };
            }
        });

        if (!results || !results[0] || !results[0].result) throw new Error("Could not parse page context.");

        const context = results[0].result;

        // If sidebar links found, show the modal selector!
        if (context.sidebarLinks && context.sidebarLinks.length > 0) {
            State.pendingModuleLinks = context.sidebarLinks;
            State.pendingSubject = context.subject;

            els.moduleList.innerHTML = context.sidebarLinks.map((link, i) => `
                <div class="module-item">
                    <input type="checkbox" id="mod-${i}" class="module-checkbox" value="${i}" checked>
                    <label for="mod-${i}" title="${link.title}">${link.title}</label>
                </div>
            `).join('');

            els.moduleSelectorModal.classList.remove('hidden');

            // Re-enable buttons while waiting for modal input
            els.refreshBtn.classList.remove('spinning');
            els.refreshBtn.textContent = "Fetch Page Files";
            return; // the rest of the logic continues in the scanModulesBtn event listener
        }

        // --- Fallback (No Sidebar, direct single page scan) ---
        els.statusText.textContent = "No modules found. Scanning current page only...";

        const fileResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const files = [];
                const BASE_URL = "https://dlsud.edu20.org";
                const allLinks = document.querySelectorAll("a[href]");
                const fileExtensions = /\.(pdf|pptx?|docx?|xlsx?|zip|jpeg|jpg|png)$/i;
                const seenUrls = new Set();

                allLinks.forEach(link => {
                    const href = link.getAttribute("href");
                    if (!href) return;
                    let fileUrl = ""; let isFile = false;
                    if (href.includes("/files/") || href.includes("/download/") || fileExtensions.test(href.split('?')[0])) {
                        isFile = true;
                        fileUrl = href.startsWith('http') ? href : BASE_URL + href;
                    }
                    if (isFile && !seenUrls.has(fileUrl)) {
                        seenUrls.add(fileUrl);
                        let filename = link.textContent.trim().replace(/\(\d+\)/g, '').trim();
                        if (!filename || filename.toLowerCase() === "download" || filename.toLowerCase() === "view") {
                            try {
                                const urlObj = new URL(fileUrl);
                                const pathParts = urlObj.pathname.split('/');
                                const lastPart = decodeURIComponent(pathParts[pathParts.length - 1]);
                                if (lastPart && lastPart.includes('.')) filename = lastPart;
                                else filename = "Attachment";
                            } catch (e) { filename = "Attachment"; }
                        }
                        let ext = "file";
                        const match = filename.match(/\.([a-z0-9]+)$/i);
                        if (match) ext = match[1].toLowerCase();
                        else {
                            const urlMatch = fileUrl.split('?')[0].match(/\.([a-z0-9]+)$/i);
                            if (urlMatch) ext = urlMatch[1].toLowerCase();
                        }
                        files.push({
                            filename: filename.replace(/\_+/g, ' '),
                            url: fileUrl,
                            extension: ext
                        });
                    }
                });
                return files;
            }
        });

        if (!fileResults || !fileResults[0] || !fileResults[0].result || fileResults[0].result.length === 0) {
            els.statusText.textContent = "No downloadable files found on this exact page.";
            resetFileFetchButtons();
            return;
        }

        const newFiles = fileResults[0].result.map(f => ({
            ...f,
            subject: context.subject,
            taskName: context.currentTitle || "Current Page",
            sourcePageUrl: context.currentHref
        }));

        State.files.push(...newFiles);
        saveAndRenderFiles();
        resetFileFetchButtons();

    } catch (err) {
        console.error("Scrape Files Error:", err);
        els.statusText.textContent = "Error scanning page.";
        resetFileFetchButtons();
    }
}

function resetFileFetchButtons() {
    els.fetchFilesInitialBtn.disabled = false;
    if (State.files.length === 0) {
        els.fetchFilesInitialBtn.classList.remove('hidden');
    }
    els.refreshBtn.classList.remove('spinning');
    els.refreshBtn.textContent = "Fetch Page Files";
}

function saveAndRenderFiles() {
    const cache = {
        timestamp: Date.now(),
        tasks: State.tasks,
        files: State.files
    };
    chrome.storage.local.set({ lastScrape: cache }, () => {
        loadCache();
    });
}

// --- Modal Action Listeners ---
els.selectAllModules.addEventListener('change', (e) => {
    document.querySelectorAll('.module-checkbox').forEach(cb => cb.checked = e.target.checked);
});

els.cancelModuleBtn.addEventListener('click', () => {
    els.moduleSelectorModal.classList.add('hidden');
    els.statusText.textContent = "Fetch Cancelled.";
});

els.scanModulesBtn.addEventListener('click', async () => {
    els.moduleSelectorModal.classList.add('hidden');

    const checkboxes = document.querySelectorAll('.module-checkbox:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (selectedIndices.length === 0) {
        els.statusText.textContent = "No modules selected.";
        return;
    }

    const targetLinks = selectedIndices.map(i => State.pendingModuleLinks[i]);

    // Resume Loading State UI
    els.statusMessage.classList.remove('hidden');
    els.fetchFilesInitialBtn.classList.add('hidden');
    els.refreshBtn.classList.add('spinning');
    els.refreshBtn.textContent = "Fetching...";

    const allFiles = [];

    try {
        for (let i = 0; i < targetLinks.length; i++) {
            const link = targetLinks[i];
            els.statusText.textContent = `Scanning Lesson: ${link.title.substring(0, 30)}... (${i + 1}/${targetLinks.length})`;

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
            els.statusText.textContent = "No files found in the selected modules.";
        } else {
            State.files.push(...allFiles);
            saveAndRenderFiles();
        }
    } catch (err) {
        console.error("Batch Scrape Error:", err);
        els.statusText.textContent = "Error scanning modules.";
    } finally {
        resetFileFetchButtons();
    }
});

// --- Boot & Cache ---

function loadCache() {
    chrome.storage.local.get(['lastScrape', 'notionToken', 'notionDbId'], (items) => {
        if (items.notionToken) document.getElementById('apiKey').value = items.notionToken;
        if (items.notionDbId) document.getElementById('dbId').value = items.notionDbId;

        const cache = items.lastScrape;
        if (cache && cache.tasks && cache.tasks.length > 0) {
            State.tasks = cache.tasks;

            // Also assign the files into the State if they exist
            if (cache.files) {
                State.files = cache.files;
            } else {
                State.files = [];
            }

            els.statusMessage.classList.add('hidden');
            renderTasks();
            renderFiles(); // Trigger rendering Files Tab

            // Determine default tab (Due Soon if it has items, otherwise Tasks)
            const dueSoonItems = cache.tasks.filter(t => {
                const d = parseDate(t.date);
                if (!d) return false;
                const now = new Date(); now.setHours(0, 0, 0, 0);
                const target = new Date(d); target.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
            });

            switchTab(dueSoonItems.length > 0 ? 'due-soon' : 'tasks');

        } else {
            els.statusMessage.classList.remove('hidden');
            els.statusText.textContent = "No tasks loaded.";
        }
    });
}

document.addEventListener('DOMContentLoaded', loadCache);