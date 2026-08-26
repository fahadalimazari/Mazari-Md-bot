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

    const roasts = [
        "You bring everyone so much joy, when you leave the room.",
        "I'd agree with you but then we’d both be wrong.",
        "You're like a cloud. When you disappear, it's a beautiful day.",
        "You have miles to go before you reach mediocre."
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🔥 *𝗥𝗢𝗔𝗦𝗧* : ${formatMention(targetUsers[0])}
│ 💬 *"${roast}"*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};