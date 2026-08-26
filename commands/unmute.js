const isAdmin = require('../lib/isAdmin');
const { getGroupMetadata } = require('../lib/myfunc');

/**
 * .unmute command - Opens group to all members and tags everyone
 */
async function unmuteCommand(sock, chatId, senderId, message) {
    try {
        // Group only command
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '❌ This command works only in groups' });
            return;
        }

        // Permission check
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗠𝗨𝗧𝗘* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗠𝗨𝗧𝗘* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗*' }, { quoted: message });
            return;
        }

        // 1. Unmute group
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        // 2. Get all participants
        const groupMetadata = await getGroupMetadata(sock, chatId);
        const participants = groupMetadata?.participants || [];

        // 3. Prepare tagging message
        let messageText = '╭─〔 ⎔ *𝗨𝗡𝗠𝗨𝗧𝗘* ⎔ 〕\n│ 🔓 *𝗚𝗥𝗢𝗨𝗣 𝗨𝗡𝗠𝗨𝗧𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*\n│ 📢 *𝗢𝗣𝗘𝗡 𝗙𝗢𝗥 𝗔𝗟𝗟 𝗠𝗘𝗠𝗕𝗘𝗥𝗦*';
        
        // 4. Send the tagged confirmation message (hidetag)
        await sock.sendMessage(chatId, {
            text: messageText,
            mentions: participants.map(p => p.id)
        }, { quoted: message });

    } catch (error) {
        console.error('Error in unmute command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to unmute and tag group. Contact owner.' });
    }
}

module.exports = unmuteCommand;
