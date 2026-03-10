// ==========================================
// scraper.js - DLSU-D DOM Parsing Logic
// ==========================================

/**
 * Scrapes subject links from the DLSUD dashboard To-Do widget.
 * This function is stringified and injected into the page via chrome.scripting.
 * @returns {Array<{subject: string, url: string}>}
 */
function scrapeWidgetLinks() {
    const rows = document.querySelectorAll(".user_todo_widget a.title_and_count");
    const links = [];

    rows.forEach(row => {
        const subjectSpan = row.querySelector("span:first-child");
        const subject = subjectSpan?.textContent?.trim();
        const relativeLink = row.getAttribute("href");

        if (subject && relativeLink) {
            links.push({
                subject: subject,
                url: "https://dlsud.edu20.org" + relativeLink
            });
        }
    });

    return links;
}

/**
 * Parses a subject's task list page.
 * Runs in the popup/background using DOMParser.
 * 
 * @param {Document} doc - The parsed HTML document of the subject page
 * @param {string} subject - The subject name (e.g., "CHEM101")
 * @param {string} subjectUrl - The URL of the subject page
 * @returns {Array<{subject: string, name: string, date: string, link: string}>}
 */
function parseSubjectPage(doc, subject, subjectUrl) {
    const tasks = [];
    const BASE_URL = "https://dlsud.edu20.org";

    const table = doc.querySelector("table.table-bordered");
    let dueIndex = -1;

    if (table) {
        const headers = table.querySelectorAll("thead th");
        let colCounter = 0;

        for (let th of headers) {
            const headerText = th.innerText.trim();
            if (headerText === "Due") {
                dueIndex = colCounter;
                break;
            }
            const span = parseInt(th.getAttribute("colspan") || "1");
            colCounter += span;
        }
    }

    const listRows = doc.querySelectorAll("td.assignment");

    if (listRows.length > 0) {
        listRows.forEach(td => {
            const anchor = td.querySelector("a");
            if (!anchor) return;

            const row = td.closest("tr");
            if (!row) return;

            let finalDate = "No Due Date";

            // If "Due" column is found via headers
            if (dueIndex > -1 && row.cells[dueIndex]) {
                const rawDate = row.cells[dueIndex].innerText.trim();
                finalDate = (rawDate === "-") ? "No Due Date" : rawDate;
            }
            // Fallback Regex on column 2 (looks for "Jan 15" format)
            else if (row.cells.length > 2) {
                const backupDate = row.cells[2].innerText.trim();
                if (/^[A-Z][a-z]{2}\s\d/.test(backupDate)) {
                    finalDate = backupDate;
                }
            }

            // Cleanup any arbitrary whitespace
            finalDate = finalDate.replace(/\s+/g, " ").trim();

            tasks.push({
                subject: subject,
                name: anchor.innerText.trim(),
                date: finalDate,
                link: BASE_URL + anchor.getAttribute("href")
            });
        });
    } else {
        // Fallback for Single Assignment Redirects
        const titleEl = doc.querySelector("#fixedSectionHeader h2");
        if (titleEl) {
            tasks.push({
                subject: subject,
                name: titleEl.innerText.trim(),
                date: "Check Link",
                link: subjectUrl
            });
        }
    }

    return tasks;
}

/**
 * Scans a task/assignment page for attachments and downloadable files.
 * @param {Document} doc - The parsed HTML document of the task page
 * @param {string} subject - The subject name (e.g., "CHEM101")
 * @param {string} taskName - The name of the task the file belongs to
 * @param {string} sourceUrl - The task page URL
 * @returns {Array<{filename: string, url: string, subject: string, taskName: string, sourcePageUrl: string, extension: string}>}
 */
function findFilesOnPage(doc, subject, taskName, sourceUrl) {
    const files = [];
    const BASE_URL = "https://dlsud.edu20.org";

    // Look for all anchors that might be files
    const allLinks = doc.querySelectorAll("a[href]");
    const fileExtensions = /\.(pdf|pptx?|docx?|xlsx?|zip|jpeg|jpg|png)$/i;

    // Set to avoid duplicates (sometimes same file has multiple links)
    const seenUrls = new Set();

    allLinks.forEach(link => {
        const href = link.getAttribute("href");
        if (!href) return;

        let fileUrl = "";
        let isFile = false;

        // Match /files/download/ or specific extensions
        if (href.includes("/files/") || href.includes("/download/") || fileExtensions.test(href.split('?')[0])) {
            isFile = true;
            fileUrl = href.startsWith('http') ? href : BASE_URL + href;
        }

        if (isFile && !seenUrls.has(fileUrl)) {
            seenUrls.add(fileUrl);

            // Extract filename from textcontent or URL
            let filename = link.textContent.trim();

            // Clean up the text content (remove things like "(4)(3)(2)")
            filename = filename.replace(/\(\d+\)/g, '').trim();

            if (!filename || filename.toLowerCase() === "download" || filename.toLowerCase() === "view") {
                // Try from URL path
                try {
                    const urlObj = new URL(fileUrl);
                    const pathParts = urlObj.pathname.split('/');
                    const lastPart = decodeURIComponent(pathParts[pathParts.length - 1]);
                    if (lastPart && lastPart.includes('.')) {
                        filename = lastPart;
                    } else {
                        filename = "Attachment";
                    }
                } catch (e) {
                    filename = "Attachment";
                }
            }

            // Extract extension
            let ext = "file";
            const match = filename.match(/\.([a-z0-9]+)$/i);
            if (match) {
                ext = match[1].toLowerCase();
            } else {
                // Try to glean from URL if filename lacks it
                const urlMatch = fileUrl.split('?')[0].match(/\.([a-z0-9]+)$/i);
                if (urlMatch) ext = urlMatch[1].toLowerCase();
            }

            files.push({
                filename: filename.replace(/\_+/g, ' '), // Clean up underscores visually
                url: fileUrl,
                subject: subject,
                taskName: taskName,
                sourcePageUrl: sourceUrl,
                extension: ext
            });
        }
    });

    return files;
}

/**
 * Scans the sidebar on a subject lesson page to get all module/lesson links.
 * Runs injected on the DLSU-D page.
 * @returns {Array<{title: string, url: string}>}
 */
function scrapeSidebarModules() {
    // Look for the sidebar container or navigation holding the TOC
    const nav = document.querySelector('.section_nav_holder') || document.querySelector('#contentWrap nav');

    if (!nav) return null; // Returns null if not on a valid subject page

    const items = [];
    const BASE_URL = "https://dlsud.edu20.org";

    // Target links that look like a section/lesson
    const links = nav.querySelectorAll('a[href*="/student_lesson/"], a[href*="/lesson/"]');

    const seenUrls = new Set();

    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        let title = "";
        const titleSpans = link.querySelectorAll('.evo-module-title');
        if (titleSpans.length > 0) {
            // Often the last span contains the actual lesson name
            title = titleSpans[titleSpans.length - 1].innerText.replace(/[\n\r]+/g, ' ').trim();
        } else {
            title = link.innerText.replace(/[\n\r]+/g, ' ').trim();
        }

        if (!title) title = "Unnamed Lesson";

        items.push({
            title: title,
            url: fullUrl
        });
    });

    return items;
}
