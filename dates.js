// Shared date helpers used by the popup and Notion sync.
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
