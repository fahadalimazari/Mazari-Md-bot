/**
 * Capacity Tracker — tracks active sessions using a Set of sessionIds.
 *
 * Using a Set ensures:
 *   - sessionId added   → count +1
 *   - same session reconnect → count unchanged (Set ignores duplicates)
 *   - session logout/terminate → remove sessionId, count -1
 *
 * This prevents reconnects from double‑counting.
 */

const activeSessions = new Set();

/**
 * Track a session as active.
 * If the sessionId is already tracked, count does not change (idempotent).
 * @param {string} sessionId - Phone number or unique session identifier.
 */
function addSession(sessionId) {
  activeSessions.add(sessionId);
}

/**
 * Remove a session from tracking.
 * @param {string} sessionId
 */
function removeSession(sessionId) {
  activeSessions.delete(sessionId);
}

/**
 * Get the current number of active sessions on this server.
 * @returns {number}
 */
function getCount() {
  return activeSessions.size;
}

/**
 * Check if a session is currently tracked.
 * @param {string} sessionId
 * @returns {boolean}
 */
function hasSession(sessionId) {
  return activeSessions.has(sessionId);
}

module.exports = { addSession, removeSession, getCount, hasSession };
