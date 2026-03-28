// ==========================================
// logger.js - UDScraper Logger Utility
// ==========================================
//
// Set DEBUG = false before publishing to the Chrome Web Store
// to silence log/warn output in production.
// Errors are always shown — they indicate real bugs.

const Logger = (() => {
    const DEBUG = true;
    const P = '[UDScraper]';

    return {
        log:   (...a) => { if (DEBUG) console.log(P, ...a); },
        warn:  (...a) => { if (DEBUG) console.warn(P, ...a); },
        error: (...a) => console.error(P, ...a),
    };
})();
