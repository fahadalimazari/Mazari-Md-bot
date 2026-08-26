module.exports = async function (sock, chatId, message, mentionedJids) {

    let targetUsers = [];
    if (mentionedJids && mentionedJids.length > 0) {
        targetUsers = [...new Set(mentionedJids)];
    }
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant && !targetUsers.includes(contextInfo.participant)) {
        targetUsers.push(contextInfo.participant);
    }

    if (targetUsers.length < 1) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗔 𝗨𝗦𝗘𝗥*' }, { quoted: message });
    }

    const formatMention = id => '@' + id.split('@')[0];

    const percent = Math.floor(Math.random() * 101);
    
    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🥺 *𝗦𝗜𝗠𝗣* : ${formatMention(targetUsers[0])}
│ 📊 *𝗦𝗜𝗠𝗣 𝗥𝗔𝗧𝗘* : *${percent}%*
│ ✦ *𝗔𝗕𝗦𝗢𝗟𝗨𝗧𝗘 𝗦𝗜𝗠𝗣*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};