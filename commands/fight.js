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

    const winner = targetUsers[Math.floor(Math.random() * 2)];
    
    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ ⚔️ *𝗙𝗜𝗚𝗛𝗧* : ${formatMention(targetUsers[0])} 𝗩𝗦 ${formatMention(targetUsers[1])}
│ 🏆 *𝗪𝗜𝗡𝗡𝗘𝗥* : ${formatMention(winner)}
│ ✦ *𝗘𝗣𝗜𝗖 𝗕𝗔𝗧𝗧𝗟𝗘 𝗢𝗨𝗧𝗖𝗢𝗠𝗘!*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0], targetUsers[1]] });
};