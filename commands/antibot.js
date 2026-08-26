const { setAntibot } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntibotCommand(sock, chatId, userMessage, senderId, msg) {
    const args = userMessage.trim().split(/\s+/);
    const action = args[1]?.toLowerCase();

    // The sender is already verified as owner/sudo in main.js before this is called
    // But we also check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗢𝗡𝗟𝗬* ⎔ 〕\n│ ⚠️ *This command can only be used in groups!*\n╰──────────────────────────────' }, { quoted: msg });
        return;
    }

    if (action === 'on') {
        const success = await setAntibot(chatId, true);
        if (success) {
            const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗕𝗢𝗧* ⎔ 〕
│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡* ✓
╰──────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: 'Failed to enable AntiBot.' }, { quoted: msg });
        }
    } else if (action === 'off') {
        const success = await setAntibot(chatId, false);
        if (success) {
            const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗕𝗢𝗧* ⎔ 〕
│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗙𝗙* ✗
╰──────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: 'Failed to disable AntiBot.' }, { quoted: msg });
        }
    } else {
        const helpUi = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗕𝗢𝗧 𝗛𝗘𝗟𝗣* ⎔ 〕
│ ✦ *.antibot on* - Enable AntiBot
│ ✦ *.antibot off* - Disable AntiBot
╰──────────────`;
        await sock.sendMessage(chatId, { text: helpUi }, { quoted: msg });
    }
}

module.exports = { handleAntibotCommand };
