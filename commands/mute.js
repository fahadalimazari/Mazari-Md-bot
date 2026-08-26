const isAdmin = require('../lib/isAdmin');

async function muteCommand(sock, chatId, senderId, message, durationInMinutes) {
    

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗠𝗨𝗧𝗘* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*' }, { quoted: message });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗠𝗨𝗧𝗘* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗*' }, { quoted: message });
        return;
    }

    try {
        // Mute the group
        await sock.groupSettingUpdate(chatId, 'announcement');
        
        if (durationInMinutes !== undefined && durationInMinutes > 0) {
            const durationInMilliseconds = durationInMinutes * 60 * 1000;
            await sock.sendMessage(chatId, { text: `╭─〔 ⎔ *𝗠𝗨𝗧𝗘* ⎔ 〕\n│ 🔒 *𝗚𝗥𝗢𝗨𝗣 𝗠𝗨𝗧𝗘𝗗 𝗙𝗢𝗥 ${durationInMinutes} 𝗠𝗜𝗡𝗦*` }, { quoted: message });
            
            // Set timeout to unmute after duration
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗠𝗨𝗧𝗘* ⎔ 〕\n│ 🔓 *𝗚𝗥𝗢𝗨𝗣 𝗔𝗨𝗧𝗢-𝗨𝗡𝗠𝗨𝗧𝗘𝗗*' });
                } catch (unmuteError) {
                    console.error('Error unmuting group:', unmuteError);
                }
            }, durationInMilliseconds);
        } else {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗠𝗨𝗧𝗘* ⎔ 〕\n│ 🔒 *𝗚𝗥𝗢𝗨𝗣 𝗠𝗨𝗧𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*' }, { quoted: message });
        }
    } catch (error) {
        console.error('Error muting/unmuting the group:', error);
        await sock.sendMessage(chatId, { text: 'An error occurred while muting/unmuting the group. Please try again.' }, { quoted: message });
    }
}

module.exports = muteCommand;
