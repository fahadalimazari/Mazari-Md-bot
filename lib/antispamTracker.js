const { getAntispam } = require('./index');
const { getSessionId, readSessionData, writeSessionData, getSessionCache } = require('./sessionManager');

function loadTracker(sessionId) {
    const cache = getSessionCache(sessionId, 'antispamTracker');
    if (!cache.has('loaded')) {
        const data = readSessionData(sessionId, 'antispamTracker.json', {});
        for (const [chatId, users] of Object.entries(data)) {
            cache.set(chatId, users);
        }
        cache.set('loaded', true);
    }
    return cache;
}

function saveTracker(sessionId, cache) {
    const data = {};
    for (const [chatId, users] of cache) {
        if (chatId !== 'loaded') data[chatId] = users;
    }
    writeSessionData(sessionId, 'antispamTracker.json', data);
}

async function handleAntispamDetection(sock, chatId, senderId, messageText, isGroup, isAdmin, senderIsOwnerOrSudo, message) {
    if (!isGroup) return;
    if (isAdmin || senderIsOwnerOrSudo) return;

    const isAntispamOn = await getAntispam(chatId);
    if (!isAntispamOn) return;

    const sessionId = getSessionId(sock);
    let tracker = loadTracker(sessionId);
    
    let chatUsers = tracker.get(chatId) || {};
    
    const THRESHOLD = (typeof isAntispamOn === 'string' && isAntispamOn !== 'on') ? parseInt(isAntispamOn) : 3;

    const userState = chatUsers[senderId] || { lastMessage: '', repeatCount: 0, lastTime: 0, messageKeys: [] };
    const now = Date.now();

    if (messageText !== userState.lastMessage || (now - userState.lastTime > 60000)) {
        userState.lastMessage = messageText;
        userState.repeatCount = 1;
        userState.messageKeys = [message.key];
    } else {
        userState.repeatCount++;
        userState.messageKeys = (userState.messageKeys || []);
        userState.messageKeys.push(message.key);
    }

    userState.lastTime = now;
    chatUsers[senderId] = userState;
    tracker.set(chatId, chatUsers);
    saveTracker(sessionId, tracker);

    if (userState.repeatCount === 2) {
        await sock.sendMessage(chatId, { 
            text: `⚠️ @${senderId.split('@')[0]}, stop sending repeated messages! One more and you will be kicked.`, 
            mentions: [senderId] 
        }, { quoted: message });
    }

    if (userState.repeatCount >= THRESHOLD) {
        console.log(`🛡️ [AntiSpam] Detecting repetition from ${senderId} in ${chatId} (${userState.repeatCount} times)`);
        
        try {
            for (const key of userState.messageKeys) {
                try {
                    await sock.sendMessage(chatId, { delete: key });
                } catch (delError) {
                    // Ignore deletion errors
                }
            }

            await sock.sendMessage(chatId, { text: `❌ @${senderId.split('@')[0]} has been kicked for spamming repeated messages! All spam messages deleted.`, mentions: [senderId] });
            
            await new Promise(r => setTimeout(r, 1000));
            
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            
            console.log(`✅ [AntiSpam] Successfully kicked spammer: ${senderId} from ${chatId}`);
            
            delete chatUsers[senderId];
            tracker.set(chatId, chatUsers);
            saveTracker(sessionId, tracker);
        } catch (error) {
            console.error(`❌ [AntiSpam] Failed to kick spammer ${senderId}:`, error.message);
        }
    }
}

module.exports = { handleAntispamDetection };
