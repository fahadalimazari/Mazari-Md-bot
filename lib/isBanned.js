const { readSessionData } = require('./sessionManager');

function isBanned(sessionId, userId) {
    if (!userId || !sessionId) return false;
    
    try {
        const bannedUsers = readSessionData(sessionId, 'banned.json', []);
        return Array.isArray(bannedUsers) ? bannedUsers.includes(userId) : !!bannedUsers[userId];
    } catch (error) {
        console.warn('⚠️ [INFO] Banned check failed:', error.message);
        return false;
    }
}

module.exports = { isBanned }; 