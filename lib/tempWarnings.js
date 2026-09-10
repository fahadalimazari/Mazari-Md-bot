const sessionContext = require('./sessionContext');

// Map: `${sessionId}:${groupId}:${userId}:${category}` -> { count: number, lastSeen: number }
const tempWarningStore = new Map();
const WARNING_TTL = 5 * 60 * 1000; // 5 minutes (300,000 ms)

/**
 * Cleanup expired entries every 60 seconds based on individual lastSeen timestamp
 */
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of tempWarningStore.entries()) {
        if (now - entry.lastSeen > WARNING_TTL) {
            tempWarningStore.delete(key);
        }
    }
}, 60 * 1000);

if (cleanupInterval.unref) {
    cleanupInterval.unref();
}

/**
 * Helper to build the isolated composite key: sessionId + groupId + userId + category
 */
function buildKey(sessionId, groupId, userId, category = 'default') {
    const sId = sessionId || sessionContext.getStore() || 'default';
    const gId = String(groupId || '').trim();
    const uId = String(userId || '').trim();
    const cat = String(category || 'default').trim();
    return `${sId}:${gId}:${uId}:${cat}`;
}

/**
 * Increment temporary warning counter with 5-minute sliding TTL
 * @param {string} sessionId
 * @param {string} groupId
 * @param {string} userId
 * @param {string} category
 * @returns {number} current warning count
 */
function incrementTempWarning(sessionId, groupId, userId, category = 'default') {
    if (!groupId || !userId) return 1;
    const key = buildKey(sessionId, groupId, userId, category);
    const now = Date.now();
    let entry = tempWarningStore.get(key);

    if (!entry || (now - entry.lastSeen > WARNING_TTL)) {
        entry = { count: 1, lastSeen: now };
        tempWarningStore.set(key, entry);
    } else {
        entry.count += 1;
        entry.lastSeen = now;
    }
    return entry.count;
}

/**
 * Reset / clear temporary warning counter
 * @param {string} sessionId
 * @param {string} groupId
 * @param {string} userId
 * @param {string} category
 * @returns {boolean}
 */
function resetTempWarning(sessionId, groupId, userId, category = 'default') {
    if (!groupId || !userId) return false;
    const key = buildKey(sessionId, groupId, userId, category);
    return tempWarningStore.delete(key);
}

/**
 * Get current temporary warning count (returns 0 if expired or not found)
 * @param {string} sessionId
 * @param {string} groupId
 * @param {string} userId
 * @param {string} category
 * @returns {number}
 */
function getTempWarning(sessionId, groupId, userId, category = 'default') {
    if (!groupId || !userId) return 0;
    const key = buildKey(sessionId, groupId, userId, category);
    const now = Date.now();
    const entry = tempWarningStore.get(key);

    if (!entry) return 0;
    if (now - entry.lastSeen > WARNING_TTL) {
        tempWarningStore.delete(key);
        return 0;
    }
    return entry.count;
}

/**
 * Clear all temporary runtime warning data belonging to a specific session (on disconnect)
 * @param {string} sessionId
 * @returns {number} number of keys cleared
 */
function clearSessionTempWarnings(sessionId) {
    if (!sessionId) return 0;
    const prefix = `${sessionId}:`;
    let cleared = 0;
    for (const key of tempWarningStore.keys()) {
        if (key.startsWith(prefix)) {
            tempWarningStore.delete(key);
            cleared++;
        }
    }
    return cleared;
}

module.exports = {
    incrementTempWarning,
    resetTempWarning,
    getTempWarning,
    clearSessionTempWarnings,
    WARNING_TTL
};
