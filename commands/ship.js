module.exports = async function (sock, chatId, message, mentionedJids) {

    let targetUsers = [];
    if (mentionedJids && mentionedJids.length > 0) {
        targetUsers = [...new Set(mentionedJids)];
    }
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant && !targetUsers.includes(contextInfo.participant)) {
        targetUsers.push(contextInfo.participant);
    }

    if (targetUsers.length < 2) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝟮 𝗨𝗦𝗘𝗥𝗦*' }, { quoted: message });
    }

    const formatMention = id => '@' + id.split('@')[0];

    const percent = Math.floor(Math.random() * 101);
    let desc = '';
    if (percent < 25) desc = '𝗧𝗘𝗥𝗥𝗜𝗕𝗟𝗘 𝗠𝗔𝗧𝗖𝗛 💔';
    else if (percent < 50) desc = '𝗔𝗩𝗘𝗥𝗔𝗚𝗘 𝗠𝗔𝗧𝗖𝗛 💛';
    else if (percent < 75) desc = '𝗚𝗢𝗢𝗗 𝗠𝗔𝗧𝗖𝗛 💖';
    else desc = '𝗣𝗘𝗥𝗙𝗘𝗖𝗧 𝗠𝗔𝗧𝗖𝗛 💘';

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 💘 *𝗦𝗛𝗜𝗣* : ${formatMention(targetUsers[0])} × ${formatMention(targetUsers[1])}
│ 📊 *𝗠𝗔𝗧𝗖𝗛* : *${percent}%*
│ ✦ *${desc}*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0], targetUsers[1]] });
};