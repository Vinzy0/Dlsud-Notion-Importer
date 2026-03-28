chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    const parser = new DOMParser();

    if (msg.action === 'parseSubjectPage') {
        const doc = parser.parseFromString(msg.html, 'text/html');
        sendResponse({ tasks: parseSubjectPage(doc, msg.subject, msg.url) });
        return true;
    }

    if (msg.action === 'findFilesOnPage') {
        const doc = parser.parseFromString(msg.html, 'text/html');
        sendResponse({ files: findFilesOnPage(doc, msg.subject, msg.taskName, msg.url) });
        return true;
    }
});
