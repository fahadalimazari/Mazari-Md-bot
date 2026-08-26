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

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🤗 *𝗛𝗨𝗚* : ${formatMention(targetUsers[0])}
│ ✦ *𝗦𝗘𝗡𝗗𝗜𝗡𝗚 𝗔 𝗪𝗔𝗥𝗠 𝗩𝗜𝗥𝗧𝗨𝗔𝗟 𝗛𝗨𝗚 💖*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};