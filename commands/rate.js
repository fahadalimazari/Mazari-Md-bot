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

    const rate = Math.floor(Math.random() * 10) + 1;
    const comments = [
        "Needs improvement!", "Pretty decent!", "Not bad at all!", "Looking great!", "Absolutely flawless!"
    ];
    const comment = comments[Math.floor(rate/2.1)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ ⭐ *𝗥𝗔𝗧𝗘* : ${formatMention(targetUsers[0])}
│ 📊 *𝗦𝗖𝗢𝗥𝗘* : *${rate}/10*
│ ✦ *${comment.toUpperCase()}*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};