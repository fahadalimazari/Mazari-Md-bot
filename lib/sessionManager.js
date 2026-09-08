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

// ---------------------------------------------------------------------
// 1. GROUP METADATA CACHE WITH STAMPEDE PREVENTION
// ---------------------------------------------------------------------
const GROUP_METADATA_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_ENTRIES = 500;
const groupMetadataCache = new Map(); // Key: "sessionId:groupId" -> { data, timestamp }
const pendingGroupRequests = new Map(); // Key: "sessionId:groupId" -> Promise

/**
 * Fetches group metadata with caching and stampede prevention.
 */
async function getCachedGroupMetadata(sock, groupId) {
    if (!groupId || !groupId.endsWith('@g.us')) return null;
    
    const sessionId = getSessionId(sock);
    const cacheKey = `${sessionId}:${groupId}`;
    const now = Date.now();

    // 1. Check cache
    const cached = groupMetadataCache.get(cacheKey);
    if (cached && (now - cached.timestamp < GROUP_METADATA_TTL)) {
        return cached.data;
    }

    // 2. Check pending requests (Stampede Prevention)
    if (pendingGroupRequests.has(cacheKey)) {
        return pendingGroupRequests.get(cacheKey);
    }

    // 3. Fetch from WhatsApp
    const fetchPromise = (async () => {
        try {
            const data = await (sock.fetchGroupMetadata ? sock.fetchGroupMetadata(groupId) : sock.groupMetadata(groupId));
            
            // Enforce size limit
            if (groupMetadataCache.size >= MAX_CACHE_ENTRIES) {
                // Delete oldest entry
                const oldestKey = groupMetadataCache.keys().next().value;
                groupMetadataCache.delete(oldestKey);
            }
            
            groupMetadataCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error(`Failed to fetch group metadata for ${groupId}:`, error.message);
            // If it failed, don't cache a failure, return null
            return null;
        } finally {
            pendingGroupRequests.delete(cacheKey);
        }
    })();

    pendingGroupRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

// ---------------------------------------------------------------------
// 2. PRIORITY MESSAGE QUEUE (Bounded Concurrency per Session)
// ---------------------------------------------------------------------
class PriorityQueue {
    constructor(concurrencyLimit = 5) {
        this.concurrencyLimit = concurrencyLimit;
        this.activeCount = 0;
        // Priority queues: 0 = HIGH, 1 = NORMAL, 2 = BACKGROUND
        this.queues = [[], [], []];
    }

    async enqueue(task, priority = 1) {
        return new Promise((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                } finally {
                    this.activeCount--;
                    this._processNext();
                }
            };

            this.queues[priority].push(wrappedTask);
            this._processNext();
        });
    }

    _processNext() {
        if (this.activeCount >= this.concurrencyLimit) return;

        // Find the highest priority task available
        let nextTask = null;
        for (let i = 0; i < this.queues.length; i++) {
            if (this.queues[i].length > 0) {
                nextTask = this.queues[i].shift();
                break;
            }
        }

        if (nextTask) {
            this.activeCount++;
            nextTask();
        }
    }
}

const sessionQueues = new Map();

/**
 * Enqueues a task for a specific session with a given priority.
 * priority: 0 (HIGH/Commands), 1 (NORMAL/Handlers), 2 (BACKGROUND/Cache)
 */
async function enqueueSessionTask(sessionId, task, priority = 1) {
    if (!sessionQueues.has(sessionId)) {
        // Allow up to 10 concurrent message processings per session to prevent event loop blocking
        sessionQueues.set(sessionId, new PriorityQueue(10));
    }
    return sessionQueues.get(sessionId).enqueue(task, priority);
}


module.exports = {
    getSessionId,
    getSessionDataPath,
    readSessionData,
    writeSessionData,
    getSessionCache,
    getCachedGroupMetadata,
    enqueueSessionTask
};
