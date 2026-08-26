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

    const actions = [
        "slapped you with a large trout! 🐟",
        "gave you a high-five... in the face! ✋",
        "smacked some sense into you! 💥",
        "delivered a ninja slap! 🥷"
    ];
    const action = actions[Math.floor(Math.random() * actions.length)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🖐️ *𝗦𝗟𝗔𝗣* : ${formatMention(targetUsers[0])}
│ ✦ *${action.toUpperCase()}*
╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};