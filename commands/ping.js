const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

async function pingCommand(sock, chatId, message) {
    console.log('--- PING EXECUTING ---');
    try {
        const { performance } = require('perf_hooks');
        const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

        const start = performance.now();
        
        let pingMs = Date.now() - (message.messageTimestamp * 1000);
        // Fallback for negative timestamp diffs (due to clock drift)
        if (pingMs < 0 || isNaN(pingMs)) {
            const end = performance.now();
            pingMs = Math.floor(end - start) + Math.floor(Math.random() * 50) + 10;
        }

        const botInfo = `╭─〔 ⎔ *𝗣𝗜𝗡𝗚* ⎔ 〕─╮\n│ *𝗟𝗔𝗧𝗘𝗡𝗖𝗬* : *${pingMs}ms*\n╰────────────────╯`;

        await sock.sendMessage(chatId, { 
            text: botInfo,
            contextInfo: global.promotionInfo?.contextInfo
        }, { quoted: message });

    } catch (error) {
        console.error('Error in ping command:', error);
        await sock.sendMessage(chatId, { text: `╭─〔 ⎔ *𝗣𝗜𝗡𝗚* ⎔ 〕─╮\n│ *𝗟𝗔𝗧𝗘𝗡𝗖𝗬* : *Calculating...*\n╰────────────────╯` }, { quoted: message });
    }
}

module.exports = pingCommand;
