const settings = require("../settings");
const { getSessionId, readSessionData } = require('../lib/sessionManager');
async function aliveCommand(sock, chatId, message) {
    try {
        const sessionId = getSessionId(sock);
        const data = readSessionData(sessionId, 'messageCount.json', { isPublic: true });
        let mode = data.isPublic ? 'Public' : 'Private';
        if (data.isPrivateInbox) mode = 'Private Inbox';

        const message1 = `*🤖 MAZARI MD is Active!*\n\n` +
            `*Version:* ${settings.version}\n` +
            `*Status:* Online\n` +
            `*Mode:* ${mode}\n\n` +
            `*ðŸŒŸ Features:*\n` +
            `â€¢ Group Management\n` +
            `â€¢ Antilink Protection\n` +
            `â€¢ Fun Commands\n` +
            `â€¢ And more!\n\n` +
            `Type *.menu* for full command list`;

        await sock.sendMessage(chatId, {
            text: message1
        }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: 'Bot is alive and running!' }, { quoted: message });
    }
}

module.exports = aliveCommand;
