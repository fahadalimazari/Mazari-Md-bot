module.exports = async function (sock, chatId, message) {
    const truths = [
        "What is your biggest fear?",
        "What is the most embarrassing thing you've ever done?",
        "Who is your secret crush?",
        "What is a lie you told recently?"
    ];
    const truth = truths[Math.floor(Math.random() * truths.length)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🤫 *𝗧𝗥𝗨𝗧𝗛*
│ ✦ *${truth}*
╰──────────────`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};