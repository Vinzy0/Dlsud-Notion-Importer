// ==========================================
// state.js - Application State & Constants
// ==========================================

/** @type {{ tasks: Array, files: Array, selectedIds: Set, activeTab: string,
 *           dismissedFileWarning: boolean, currentTabUrl: string, darkMode: boolean,
 *           completedTaskIds: Set,
 *           searchQuery: string, subjectFilter: string, sortBy: string,
 *           pendingModuleLinks: Array, pendingSubject: string }} */
export const State = {
    tasks: [],
    files: [],
    selectedIds: new Set(),
    activeTab: 'tasks',
    dismissedFileWarning: false,
    currentTabUrl: '',
    darkMode: false,
    completedTaskIds: new Set(),
    searchQuery: '',
    subjectFilter: '',
    sortBy: 'grouped',
    pendingModuleLinks: [],
    pendingSubject: '',
    notionConnected: false,
    collapsedSubjects: new Set(),
};

/** Curated subject color palette — cycles by subject name hash. */
export const SUBJECT_PALETTE = [
    { bg: 'rgba(99,102,241,0.18)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    { bg: 'rgba(236,72,153,0.18)',  text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
    { bg: 'rgba(52,211,153,0.18)',  text: '#6ee7b7', border: 'rgba(52,211,153,0.3)' },
    { bg: 'rgba(251,146,60,0.18)',  text: '#fdba74', border: 'rgba(251,146,60,0.3)' },
    { bg: 'rgba(96,165,250,0.18)',  text: '#93bbfd', border: 'rgba(96,165,250,0.3)' },
    { bg: 'rgba(163,230,53,0.18)',  text: '#bef264', border: 'rgba(163,230,53,0.3)' },
    { bg: 'rgba(248,113,113,0.18)', text: '#fca5a5', border: 'rgba(248,113,113,0.3)' },
    { bg: 'rgba(45,212,191,0.18)',  text: '#5eead4', border: 'rgba(45,212,191,0.3)' },
    { bg: 'rgba(251,191,36,0.18)',  text: '#fde68a', border: 'rgba(251,191,36,0.3)' },
    { bg: 'rgba(192,132,252,0.18)', text: '#d8b4fe', border: 'rgba(192,132,252,0.3)' },
    { bg: 'rgba(34,211,238,0.18)',  text: '#67e8f9', border: 'rgba(34,211,238,0.3)' },
    { bg: 'rgba(244,114,182,0.18)', text: '#f9a8d4', border: 'rgba(244,114,182,0.3)' },
];

/** Reusable inline SVG icon strings (trusted constants, not user data). */
export const ICONS = {
    check: '<svg class="check-icon" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    externalLink: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10"/><path d="M9 2h5v5"/><path d="M14 2L7 9"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M3 12h10"/></svg>',
    toastSuccess: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5.5 8l2 2 3-3.5"/></svg>',
    toastError: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4"/></svg>',
    toastInfo: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v4"/><circle cx="8" cy="5" r="0.5" fill="currentColor"/></svg>',
};

export const REFRESH_ICON = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1v5h5"/><path d="M3.51 10a6 6 0 1 0 .49-5L1 6"/></svg>`;
