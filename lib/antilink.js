const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilink, incrementWarningCount, resetWarningCount, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const config = require('../config');

const WARN_COUNT = 3; // Enforce 3 warnings as requested

// In-memory cache for group antilink settings to avoid frequent disk I/O
const settingsCache = new Map(); // chatId -> { config: object, timestamp: number }
const SETTINGS_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Checks if a string contains a URL.
 */
function containsURL(str) {
    const urlRegex = /(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/i;
    return urlRegex.test(str);
}

/**
 * Extracts domains from a string to verify against allowed list.
 */
function extractDomains(str) {
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})(?:\/[^\s]*)?/gi;
    let domains = [];
    let match;
    while ((match = urlRegex.exec(str)) !== null) {
        if (match[1]) {
            domains.push(match[1].toLowerCase());
        }
    }
    return domains;
}

/**
 * Gets antilink settings with in-memory caching.
 */
async function getCachedAntilink(chatId) {
    const now = Date.now();
    const cached = settingsCache.get(chatId);
    
    if (cached && (now - cached.timestamp) < SETTINGS_CACHE_TTL) {
        return cached.config;
    }
    
    const antilinkConfig = await getAntilink(chatId, 'on');
    settingsCache.set(chatId, { config: antilinkConfig, timestamp: now });
    return antilinkConfig;
}

/**
 * Handles the Antilink functionality for group chats.
 */
async function Antilink(msg, sock) {
    const chatId = msg.key.remoteJid;
    if (!chatId || !isJidGroup(chatId)) return;

    // 1. Fast path: Extract text and check for link before heavy work
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || 
                 msg.message?.imageMessage?.caption || 
                 msg.message?.videoMessage?.caption || '';
                 
    if (!text || !containsURL(text)) return;

    // 2. Fetch config (fast cached path)
    const antilinkConfig = await getCachedAntilink(chatId);
    if (!antilinkConfig || !antilinkConfig.enabled) return;

    // 3. Allowed Domain Check
    const allowedDomains = antilinkConfig.allowedDomains || [];
    const domainsInText = extractDomains(text);
    
    if (domainsInText.length > 0 && domainsInText.every(domain => allowedDomains.includes(domain))) {
        return; // All detected domains are allowed, do not punish.
    }

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender || msg.key.fromMe) return;

    // 4. Permission checks (Sudo & Admin)
    const senderIsSudo = await isSudo(sender);
    if (senderIsSudo) return;

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, sender);
    if (isSenderAdmin || !isBotAdmin) return;

    const action = antilinkConfig.action || 'delete';

    try {
        // 5. PRIORITY: Remove link immediately
        await sock.sendMessage(chatId, { delete: msg.key });
        
        if (action === 'delete') {
            return; // Delete only
        }

        if (action === 'kick') {
            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            await resetWarningCount(chatId, sender);
            return;
        }

        if (action === 'warn') {
            const warningCount = await incrementWarningCount(chatId, sender);
            
            if (warningCount >= WARN_COUNT) {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await resetWarningCount(chatId, sender);
            } else {
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞 𝗪𝗔𝗥𝗡* ⎔ 〕\n│ ⚠️ *@${sender.split('@')[0]}*\n│ ✦ *𝗪𝗔𝗥𝗡𝗜𝗡𝗚* : *${warningCount}/${WARN_COUNT}*\n│ 🔗 *𝗟𝗜𝗡𝗞𝗦 𝗔𝗥𝗘 𝗡𝗢𝗧 𝗔𝗟𝗟𝗢𝗪𝗘𝗗*`;
                await sock.sendMessage(chatId, { text: ui, mentions: [sender] }, { quoted: msg });
            }
        }
    } catch (error) {
        console.error('Error in Antilink processing:', error);
    }
}

module.exports = { Antilink };