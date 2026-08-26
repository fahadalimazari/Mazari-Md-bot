const { setPdm, getPdm, setPdmDefault } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');

async function handlePdmCommand(sock, chatId, userMessage, senderId, _isSenderAdmin, message) {
    try {
        const isSenderSudo = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!isSenderSudo) {
            await sock.sendMessage(chatId, { text: '```For Owner/Sudo Only!```' }, { quoted: message });
            return;
        }

        const args = userMessage.slice(4).toLowerCase().trim().split(' ').filter(Boolean);
        const action = args.join(' ');

        if (!action || (action !== 'on' && action !== 'off' && action !== 'default on' && action !== 'default off')) {
            await sock.sendMessage(chatId, { text: `❌ Unknown option. Use \`.pdm on\`, \`.pdm off\`, \`.pdm default on\`, or \`.pdm default off\`.` }, { quoted: message });
            return;
        }

        if (action === 'on') {
            const current = await getPdm(chatId);
            if (!current) {
                await setPdm(chatId, true);
            }
            const ui = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗔𝗟𝗘𝗥𝗧𝗦* ⎔ 〕\n│ 🟢 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗚𝗥𝗢𝗨𝗣 𝗖𝗛𝗔𝗡𝗚𝗘𝗦 𝗔𝗥𝗘 𝗡𝗢𝗪 𝗧𝗥𝗔𝗖𝗞𝗘𝗗*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'off') {
            await setPdm(chatId, false);
            const ui = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗔𝗟𝗘𝗥𝗧𝗦* ⎔ 〕\n│ 🔴 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗚𝗥𝗢𝗨𝗣 𝗖𝗛𝗔𝗡𝗚𝗘𝗦 𝗔𝗥𝗘 𝗡𝗢 𝗟𝗢𝗡𝗚𝗘𝗥 𝗧𝗥𝗔𝗖𝗞𝗘𝗗*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'default on') {
            await setPdmDefault(true);
            const ui = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗔𝗟𝗘𝗥𝗧𝗦* ⎔ 〕\n│ 🌍 *𝗚𝗟𝗢𝗕𝗔𝗟 𝗗𝗘𝗙𝗔𝗨𝗟𝗧* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗔𝗨𝗧𝗢𝗠𝗔𝗧𝗜𝗖𝗔𝗟𝗟Ｙ 𝗘𝗡𝗔𝗕𝗟𝗘𝗗 𝗜𝗡 𝗣𝗨𝗕𝗟𝗜𝗖 𝗠𝗢𝗗𝗘*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'default off') {
            await setPdmDefault(false);
            const ui = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗔𝗟𝗘𝗥𝗧𝗦* ⎔ 〕\n│ 🌍 *𝗚𝗟𝗢𝗕𝗔𝗟 𝗗𝗘𝗙𝗔𝗨𝗟𝗧* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗔𝗨𝗧𝗢𝗠𝗔𝗧𝗜𝗖𝗔𝗟𝗟Ｙ 𝗗𝗜𝗦𝗔𝗕𝗟𝗘𝗗*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in pdm command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing pdm command_*' }, { quoted: message });
    }
}

module.exports = {
    handlePdmCommand
};
