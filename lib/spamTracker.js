const { getSessionId, readSessionData, writeSessionData, getSessionCache } = require('./sessionManager');

function loadTracker(sessionId) {
    const cache = getSessionCache(sessionId, 'spamTracker');
    if (!cache.has('loaded')) {
        const data = readSessionData(sessionId, 'spamTracker.json', {});
        for (const [jid, state] of Object.entries(data)) {
            cache.set(jid, state);
        }
        cache.set('loaded', true);
    }
    return cache;
}

function saveTracker(sessionId, cache) {
    const data = {};
    for (const [jid, state] of cache) {
        if (jid !== 'loaded') data[jid] = state;
    }
    writeSessionData(sessionId, 'spamTracker.json', data);
}

/**
 * Checks if a user is marked as blocked or ignored in the spam tracker.
 * @param {string} sessionId - The session ID.
 * @param {string} jid - The user's JID.
 * @returns {boolean} - True if the user should be ignored.
 */
function isUserIgnored(sessionId, jid) {
    const tracker = loadTracker(sessionId);
    const userData = tracker.get(jid);
    return userData && (userData.blocked || userData.ignored);
}

async function handleSpamDetection(sock, jid, isMe, senderIsOwnerOrSudo, isGroup, getAutoblockStatus) {
    if (isGroup) return;

    const sessionId = getSessionId(sock);
    const tracker = loadTracker(sessionId);

    if (isMe) {
        if (tracker.has(jid)) {
            const state = tracker.get(jid);
            if (!state.blocked && !state.ignored) {
                tracker.delete(jid);
                saveTracker(sessionId, tracker);
            } else {
                state.count = 0;
                state.blocked = false;
                state.ignored = false;
                tracker.set(jid, state);
                saveTracker(sessionId, tracker);
            }
        }
        return;
    }

    if (senderIsOwnerOrSudo) return;

    const currentState = tracker.get(jid);
    if (currentState && (currentState.blocked || currentState.ignored)) {
        return;
    }

    const isAutoblockOn = await getAutoblockStatus(sock);
    if (!isAutoblockOn) return;

    const now = Date.now();
    const SPAM_LIMIT = 6;
    const RESET_TIME = 20 * 60 * 1000;

    let userState = currentState || { count: 0, lastMessageTime: 0, blocked: false, ignored: false };

    if (now - userState.lastMessageTime > RESET_TIME) {
        userState.count = 0;
    }

    userState.count++;
    userState.lastMessageTime = now;
    tracker.set(jid, userState);

    if (userState.count >= SPAM_LIMIT) {
        console.log(`🛡️ [SpamTracker] Handling spammer ${jid} (${userState.count} messages without reply)`);
        
        if (jid.endsWith('@s.whatsapp.net')) {
            try {
                await sock.updateBlockStatus(jid, 'block');
                userState.blocked = true;
                console.log(`✅ [SpamTracker] Successfully blocked spammer: ${jid}`);
            } catch (error) {
                console.error(`❌ [SpamTracker] Failed to block spammer ${jid}:`, error.message);
                userState.blocked = true;
                userState.ignored = true;
            }
        } else {
            userState.blocked = true;
            userState.ignored = true;
            console.log(`🛡️ [SpamTracker] Simulated block for non-blockable JID: ${jid}`);
        }
        tracker.set(jid, userState);
    }

    saveTracker(sessionId, tracker);
}

module.exports = { handleSpamDetection, isUserIgnored };
