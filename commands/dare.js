module.exports = async function (sock, chatId, message) {
    const dares = [
        "Send a voice note singing a song.",
        "Change your profile picture to a monkey for 24 hours.",
        "Send the 5th picture in your gallery.",
        "Type your next 5 messages using only your nose."
    ];
    const dare = dares[Math.floor(Math.random() * dares.length)];

    const text = `╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 😈 *𝗗𝗔𝗥𝗘*
│ ✦ *${dare}*
╰──────────────`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};