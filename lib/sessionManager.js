const path = require('path');
const fs = require('fs');
const { safeReadJson, atomicWriteJson, atomicWriteJsonAsync } = require('./storage');

// Memory cache for runtime bot states (cooldowns, toggles) separated by sessionId
const globalCaches = new Map();

// JSON file cache to prevent disk I/O bottlenecks
const jsonFileCache = new Map();
const writeLocks = new Map();

/**
 * Ensures the session data directory exists and returns the file path.
 */
function getSessionDataPath(sessionId, fileName) {
    if (!sessionId) sessionId = 'global';
    const dir = path.join(__dirname, '../data/sessions', sessionId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, fileName);
}

/**
 * Extracts the standard sessionId (phone number) from a socket object.
 */
function getSessionId(sock) {
    if (sock && sock.user && sock.user.id) {
        return sock.user.id.split(':')[0].split('@')[0];
    }
    return 'default';
}

/**
 * Reads a JSON file specifically for the given session. Uses in-memory cache to prevent blocking.
 */
function readSessionData(sessionId, fileName, defaultData = {}) {
    const filePath = getSessionDataPath(sessionId, fileName);
    if (jsonFileCache.has(filePath)) {
        return jsonFileCache.get(filePath);
    }
    
    const data = safeReadJson(filePath, defaultData);
    jsonFileCache.set(filePath, data);
    return data;
}

/**
 * Writes data to memory cache instantly, and debounces an asynchronous write to disk.
 */
function writeSessionData(sessionId, fileName, data) {
    const filePath = getSessionDataPath(sessionId, fileName);
    
    // Update memory cache instantly
    jsonFileCache.set(filePath, data);
    
    if (writeLocks.has(filePath)) {
        clearTimeout(writeLocks.get(filePath));
    }
    
    const timeout = setTimeout(async () => {
        writeLocks.delete(filePath);
        if (typeof atomicWriteJsonAsync === 'function') {
            await atomicWriteJsonAsync(filePath, data);
        } else {
            atomicWriteJson(filePath, data);
        }
    }, 150); // Debounce interval
    
    writeLocks.set(filePath, timeout);
    return true;
}

/**
 * Retrieves a session-specific runtime memory Map (e.g., for cooldowns).
 */
function getSessionCache(sessionId, cacheName) {
    const masterKey = `${sessionId}:${cacheName}`;
    if (!globalCaches.has(masterKey)) {
        globalCaches.set(masterKey, new Map());
    }
    return globalCaches.get(masterKey);
}

module.exports = {
    getSessionId,
    getSessionDataPath,
    readSessionData,
    writeSessionData,
    getSessionCache
};
