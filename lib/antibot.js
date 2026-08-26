const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntibot, incrementAntibotWarningCount, resetAntibotWarningCount, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// In-memory cache for group antibot settings to avoid frequent disk I/O
const settingsCache = new Map(); // chatId -> { config: boolean, timestamp: number }
const SETTINGS_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Gets antibot settings with in-memory caching.
 */
async function getCachedAntibot(chatId) {
    const now = Date.now();
    const cached = settingsCache.get(chatId);
    
    if (cached && (now - cached.timestamp) < SETTINGS_CACHE_TTL) {
        return cached.config;
    }
    
    const antibotConfig = await getAntibot(chatId);
    settingsCache.set(chatId, { config: antibotConfig, timestamp: now });
    return antibotConfig;
}

/**
 * Checks if a message is from a typical automated/bot client.
 */
function isBotMessage(msg) {
    if (!msg || !msg.key) return false;
    const id = msg.key.id;
    
    // 1. Check ID patterns (Baileys, etc.)
    if (id && (id.length > 21 || id.startsWith('BAE5') || id.startsWith('3EB0'))) {
        return true;
    }

    // 2. Check for interactive message types (API/Bots only)
    if (msg.message?.buttonsMessage || 
        msg.message?.templateMessage || 
        msg.message?.listMessage || 
        msg.message?.interactiveMessage) {
        return true;
    }

    // 3. Check message text for typical bot menus/ping responses
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || 
                 msg.message?.imageMessage?.caption || 
                 msg.message?.videoMessage?.caption || '';
                 
    const lowerText = text.toLowerCase();
    
    // Common menu UI boxes
    if (text.includes('╭─〔') || text.includes('╰──────') || text.includes('╔═') || text.includes('╚═')) {
         return true;
    }
    
    // Common ping/uptime formats
    if (lowerText.match(/uptime\s*:/) || lowerText.match(/speed\s*:/) || lowerText.match(/ping\s*:/) || lowerText === 'pong!') {
        return true;
    }

    return false;
}

/**
 * Handles the Antibot functionality for group chats.
 */
async function Antibot(msg, sock) {
    const chatId = msg.key.remoteJid;
    if (!chatId || !isJidGroup(chatId)) return;
    if (msg.key.fromMe) return;

    // 1. Fast path: check if it's a suspected bot message
    if (!isBotMessage(msg)) return;

    // 2. Fetch config (fast cached path)
    const isAntibotEnabled = await getCachedAntibot(chatId);
    if (!isAntibotEnabled) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender) return;

    // 3. Permission checks (Sudo & Admin)
    const senderIsSudo = await isSudo(sender);
    if (senderIsSudo) return;

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, sender);
    if (isSenderAdmin || !isBotAdmin) return;

    try {
        // Increment warning first
        const warningCount = await incrementAntibotWarningCount(chatId, sender);

        if (warningCount === 1) {
            // First Detection: Warning
            try {
                await sock.sendMessage(chatId, { delete: msg.key });
            } catch (e) {
                console.error('Antibot: Failed to delete first bot message:', e);
            }
            
            const warningUi = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗕𝗢𝗧* ⎔ 〕
│ ⚠️ *𝗪𝗔𝗥𝗡𝗜𝗡𝗚* : *𝟭/𝟭*
│ 🤖 *𝗕𝗢𝗧 𝗗𝗘𝗧𝗘𝗖𝗧𝗘𝗗*
│ ✦ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗧𝗛𝗘 𝗕𝗢𝗧 𝗣𝗥𝗜𝗩𝗔𝗧𝗘*
│ ⚠️ *𝗡𝗘𝗫𝗧 𝗧𝗜𝗠𝗘 = 𝗥𝗘𝗠𝗢𝗩𝗔𝗟*
╰──────────────`;
            await sock.sendMessage(chatId, { text: warningUi, mentions: [sender] }, { quoted: msg });
        } else {
            // Second Detection: Removal
            try {
                await sock.sendMessage(chatId, { delete: msg.key });
            } catch (e) {
                console.error('Antibot: Failed to delete second bot message:', e);
            }

            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            await resetAntibotWarningCount(chatId, sender);
            
            const removalUi = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗕𝗢𝗧* ⎔ 〕
│ 🚫 *𝗕𝗢𝗧 𝗥𝗘𝗠𝗢𝗩𝗘𝗗*
│ ✦ *𝗦𝗘𝗖𝗢𝗡𝗗 𝗩𝗜𝗢𝗟𝗔𝗧𝗜𝗢𝗡*
╰──────────────`;
            await sock.sendMessage(chatId, { text: removalUi });
        }
    } catch (error) {
        console.error('Error in Antibot processing:', error);
    }
}

module.exports = { Antibot };
