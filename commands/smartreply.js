const fs = require('fs');
const path = require('path');
const { safeReadJson, atomicWriteJson } = require('../lib/storage');

const statusPath = path.join(__dirname, '../data/smartReply.json');

// Track last reply time per user/chat for cooldown
const lastSmartReplyTime = {};

// Smart Reply Response Pool
const smartReplyPool = {
    greeting_urdu: [
        'Wa Alaikum Assalam 🌸 How are you?',
        'Aslam o Alaikum! Kya haal hai?',
        'Alaikum Assalam! Sab theek?',
        'Wa Alaikum Assalam! Kya chal raha hai?',
        'Assalam o Alaikum 😊 Batao, kya scene hai?',
    ],
    greeting_english: [
        'Hello! 👋 How can I help?',
        'Hi there! 😄 Kya haal hai?',
        'Hey! 👋 What\'s up?',
        'Hello bro! 😊 Sab theek?',
        'Hi! How are you doing?',
    ],
    how_are_you: [
        'Alhamdulillah, theek hun! 😊 Tu kaisa hai?',
        'Badhiya hun! Tum batao? 😄',
        'All good! Kya haal hai tum ka?',
        'Sab khairiyat! Aap theek ho?',
        'Bilkul theek hun! Tu kya bol raha hai?',
    ]
};

// Get random response from pool
function getRandomReply(category) {
    const replies = smartReplyPool[category] || [];
    return replies[Math.floor(Math.random() * replies.length)] || '';
}

// Check if message is a greeting (fuzzy matching)
function isGreetingMessage(text) {
    // Convert to lowercase and trim
    const cleanText = text.toLowerCase().trim();
    
    // Urdu/Pakistani style greetings - use flexible matching
    const urduGreetings = [
        'aoa', 'assalam', 'aslam', 'slam', 'salam', 'alaikum', 'alikum',
        'walaikum', 'wa alaikum', 'assalamo alaikum', 'aslamo alaikum'
    ];
    
    // English greetings - use flexible matching
    const englishGreetings = [
        'hi', 'hello', 'hey', 'helo', 'hii', 'helloo', 'hy', 'helo', 'hello!', 'hi!', 'hey!'
    ];
    
    // How are you variations
    const howAreYouPatterns = [
        'kia hal', 'kaisa hal', 'kaise ho', 'kya hal', 'hall', 'haal', 'kaise', 'how are', 'how r u', 'r u ok', 'theek ho'
    ];

    // Check for Urdu greetings using includes (flexible matching)
    for (const greeting of urduGreetings) {
        if (cleanText.includes(greeting)) {
            return 'greeting_urdu';
        }
    }

    // Check for English greetings using includes (flexible matching)
    for (const greeting of englishGreetings) {
        if (cleanText.includes(greeting)) {
            return 'greeting_english';
        }
    }

    // Check for "how are you" patterns
    for (const pattern of howAreYouPatterns) {
        if (cleanText.includes(pattern)) {
            return 'how_are_you';
        }
    }

    return null;
}



const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');

// Helper to get status
function getSmartReplyStatus(sessionId) {
    const data = readSessionData(sessionId, 'smartReply.json', { enabled: false });
    return data.enabled === true;
}

async function smartreplyCommand(sock, chatId, message, args, senderId, isGroup) {
    const sessionId = getSessionId(sock);
    const sub = (args[0] || '').toLowerCase();
    
    if (sub === 'on') {
        writeSessionData(sessionId, 'smartReply.json', { enabled: true });
        const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗥𝗘𝗣𝗟𝗬* ⎔ 〕─╮\n│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡* ✓\n╰────────────────────╯`;
        await sock.sendMessage(chatId, { text: uiText });
    } else if (sub === 'off') {
        writeSessionData(sessionId, 'smartReply.json', { enabled: false });
        const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗥𝗘𝗣𝗟𝗬* ⎔ 〕─╮\n│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗙𝗙* ✓\n╰────────────────────╯`;
        await sock.sendMessage(chatId, { text: uiText });
    } else if (sub === 'status') {
        const state = getSmartReplyStatus(sessionId) ? 'ON ✅' : 'OFF ❌';
        await sock.sendMessage(chatId, { text: `⚙️ SmartReply is currently: ${state}` }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, { text: '❓ Usage:\n.smartreply on (Enable for everyone)\n.smartreply off (Disable for everyone)\n.smartreply status' }, { quoted: message });
    }
}

module.exports = { 
    smartreplyCommand, 
    getSmartReplyStatus,
    isGreetingMessage,
    getRandomReply,
    smartReplyPool,
    lastSmartReplyTime
};
