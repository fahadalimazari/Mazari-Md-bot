module.exports = async function (sock, chatId, message) {
    const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call fake spaghetti? An impasta!",
        "Why did the scarecrow win an award? Because he was outstanding in his field!",
        "Why don't skeletons fight each other? They don't have the guts."
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🤡 *𝗝𝗢𝗞𝗘*
│ ✦ *${joke}*
╰──────────────`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};