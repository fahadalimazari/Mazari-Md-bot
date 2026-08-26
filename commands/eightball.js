module.exports = async function (sock, chatId, message, args) {
    if (!args || args.trim() === '') {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗔𝗦𝗞 𝗔 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡*' }, { quoted: message });
    }
    const answers = [
        "Yes, absolutely!", "No, definitely not.", "Maybe...", "Ask again later.", "Without a doubt."
    ];
    const answer = answers[Math.floor(Math.random() * answers.length)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🎱 *𝟴𝗕𝗔𝗟𝗟*
│ ❓ *𝗤* : ${args.trim()}
│ ✦ *${answer.toUpperCase()}*
╰──────────────`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};