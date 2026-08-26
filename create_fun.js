const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, 'commands');

const getTargetsLogic = `
    let targetUsers = [];
    if (mentionedJids && mentionedJids.length > 0) {
        targetUsers = [...new Set(mentionedJids)];
    }
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant && !targetUsers.includes(contextInfo.participant)) {
        targetUsers.push(contextInfo.participant);
    }
`;

const uiHelper = `
    const formatMention = id => '@' + id.split('@')[0];
`;

const templates = {
    'ship.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 2) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝟮 𝗨𝗦𝗘𝗥𝗦*' }, { quoted: message });
    }
${uiHelper}
    const percent = Math.floor(Math.random() * 101);
    let desc = '';
    if (percent < 25) desc = '𝗧𝗘𝗥𝗥𝗜𝗕𝗟𝗘 𝗠𝗔𝗧𝗖𝗛 💔';
    else if (percent < 50) desc = '𝗔𝗩𝗘𝗥𝗔𝗚𝗘 𝗠𝗔𝗧𝗖𝗛 💛';
    else if (percent < 75) desc = '𝗚𝗢𝗢𝗗 𝗠𝗔𝗧𝗖𝗛 💖';
    else desc = '𝗣𝗘𝗥𝗙𝗘𝗖𝗧 𝗠𝗔𝗧𝗖𝗛 💘';

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 💘 *𝗦𝗛𝗜𝗣* : \${formatMention(targetUsers[0])} × \${formatMention(targetUsers[1])}
│ 📊 *𝗠𝗔𝗧𝗖𝗛* : *\${percent}%*
│ ✦ *\${desc}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0], targetUsers[1]] });
};`,

    'rate.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 1) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗔 𝗨𝗦𝗘𝗥*' }, { quoted: message });
    }
${uiHelper}
    const rate = Math.floor(Math.random() * 10) + 1;
    const comments = [
        "Needs improvement!", "Pretty decent!", "Not bad at all!", "Looking great!", "Absolutely flawless!"
    ];
    const comment = comments[Math.floor(rate/2.1)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ ⭐ *𝗥𝗔𝗧𝗘* : \${formatMention(targetUsers[0])}
│ 📊 *𝗦𝗖𝗢𝗥𝗘* : *\${rate}/10*
│ ✦ *\${comment.toUpperCase()}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};`,

    'simp.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 1) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗔 𝗨𝗦𝗘𝗥*' }, { quoted: message });
    }
${uiHelper}
    const percent = Math.floor(Math.random() * 101);
    
    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🥺 *𝗦𝗜𝗠𝗣* : \${formatMention(targetUsers[0])}
│ 📊 *𝗦𝗜𝗠𝗣 𝗥𝗔𝗧𝗘* : *\${percent}%*
│ ✦ *𝗔𝗕𝗦𝗢𝗟𝗨𝗧𝗘 𝗦𝗜𝗠𝗣*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};`,

    'roast.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 1) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗔 𝗨𝗦𝗘𝗥*' }, { quoted: message });
    }
${uiHelper}
    const roasts = [
        "You bring everyone so much joy, when you leave the room.",
        "I'd agree with you but then we’d both be wrong.",
        "You're like a cloud. When you disappear, it's a beautiful day.",
        "You have miles to go before you reach mediocre."
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🔥 *𝗥𝗢𝗔𝗦𝗧* : \${formatMention(targetUsers[0])}
│ 💬 *"\${roast}"*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};`,

    'slap.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 1) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗔 𝗨𝗦𝗘𝗥*' }, { quoted: message });
    }
${uiHelper}
    const actions = [
        "slapped you with a large trout! 🐟",
        "gave you a high-five... in the face! ✋",
        "smacked some sense into you! 💥",
        "delivered a ninja slap! 🥷"
    ];
    const action = actions[Math.floor(Math.random() * actions.length)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🖐️ *𝗦𝗟𝗔𝗣* : \${formatMention(targetUsers[0])}
│ ✦ *\${action.toUpperCase()}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};`,

    'hug.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 1) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗔 𝗨𝗦𝗘𝗥*' }, { quoted: message });
    }
${uiHelper}
    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🤗 *𝗛𝗨𝗚* : \${formatMention(targetUsers[0])}
│ ✦ *𝗦𝗘𝗡𝗗𝗜𝗡𝗚 𝗔 𝗪𝗔𝗥𝗠 𝗩𝗜𝗥𝗧𝗨𝗔𝗟 𝗛𝗨𝗚 💖*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0]] });
};`,

    'fight.js': `
module.exports = async function (sock, chatId, message, mentionedJids) {
${getTargetsLogic}
    if (targetUsers.length < 2) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝟮 𝗨𝗦𝗘𝗥𝗦*' }, { quoted: message });
    }
${uiHelper}
    const winner = targetUsers[Math.floor(Math.random() * 2)];
    
    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ ⚔️ *𝗙𝗜𝗚𝗛𝗧* : \${formatMention(targetUsers[0])} 𝗩𝗦 \${formatMention(targetUsers[1])}
│ 🏆 *𝗪𝗜𝗡𝗡𝗘𝗥* : \${formatMention(winner)}
│ ✦ *𝗘𝗣𝗜𝗖 𝗕𝗔𝗧𝗧𝗟𝗘 𝗢𝗨𝗧𝗖𝗢𝗠𝗘!*
╰──────────────\`;

    await sock.sendMessage(chatId, { text, mentions: [targetUsers[0], targetUsers[1]] });
};`,

    'truth.js': `
module.exports = async function (sock, chatId, message) {
    const truths = [
        "What is your biggest fear?",
        "What is the most embarrassing thing you've ever done?",
        "Who is your secret crush?",
        "What is a lie you told recently?"
    ];
    const truth = truths[Math.floor(Math.random() * truths.length)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🤫 *𝗧𝗥𝗨𝗧𝗛*
│ ✦ *\${truth}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};`,

    'dare.js': `
module.exports = async function (sock, chatId, message) {
    const dares = [
        "Send a voice note singing a song.",
        "Change your profile picture to a monkey for 24 hours.",
        "Send the 5th picture in your gallery.",
        "Type your next 5 messages using only your nose."
    ];
    const dare = dares[Math.floor(Math.random() * dares.length)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 😈 *𝗗𝗔𝗥𝗘*
│ ✦ *\${dare}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};`,

    'eightball.js': `
module.exports = async function (sock, chatId, message, args) {
    if (!args || args.trim() === '') {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕\\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗔𝗦𝗞 𝗔 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡*' }, { quoted: message });
    }
    const answers = [
        "Yes, absolutely!", "No, definitely not.", "Maybe...", "Ask again later.", "Without a doubt."
    ];
    const answer = answers[Math.floor(Math.random() * answers.length)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🎱 *𝟴𝗕𝗔𝗟𝗟*
│ ❓ *𝗤* : \${args.trim()}
│ ✦ *\${answer.toUpperCase()}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};`,

    'joke.js': `
module.exports = async function (sock, chatId, message) {
    const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call fake spaghetti? An impasta!",
        "Why did the scarecrow win an award? Because he was outstanding in his field!",
        "Why don't skeletons fight each other? They don't have the guts."
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];

    const text = \`╭─〔 ⎔ *𝗙𝗨𝗡* ⎔ 〕
│ 🤡 *𝗝𝗢𝗞𝗘*
│ ✦ *\${joke}*
╰──────────────\`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
};`
};

for (const [filename, content] of Object.entries(templates)) {
    fs.writeFileSync(path.join(commandsDir, filename), content.trim());
}
console.log('All 11 command files created successfully.');
