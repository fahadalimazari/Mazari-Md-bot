const isAdmin = require('../lib/isAdmin');

module.exports = async function (sock, chatId, senderId, message, args) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) {
        return await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗦𝗣𝗔𝗠* ⎔ 〕\n│ ❌ *𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗖𝗔𝗡 𝗢𝗡𝗟𝗬 𝗕𝗘 𝗨𝗦𝗘𝗗 𝗜𝗡 𝗚𝗥𝗢𝗨𝗣𝗦*' }, { quoted: message });
    }

    const isOwner = message.key.fromMe;
    if (!isOwner) {
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗦𝗣𝗔𝗠* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗*' }, { quoted: message });
            return;
        }
    }

    // Try to get message to spam from reply or args
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let spamContent = '';
    let count = 0;

    if (quoted) {
        // Replied to a message
        const contentUnpacked = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
        spamContent = contentUnpacked.conversation ||
                        contentUnpacked.extendedTextMessage?.text ||
                        '';
        
        if (!spamContent) {
            // Check for media caption if no text
            spamContent = contentUnpacked.imageMessage?.caption ||
                          contentUnpacked.videoMessage?.caption ||
                          contentUnpacked.documentMessage?.caption ||
                          '';
        }

        // Count is the first argument
        if (args.length > 0 && !isNaN(parseInt(args[0]))) {
            count = parseInt(args[0]);
        }
    } else {
        // Direct text
        if (args.length >= 2 && !isNaN(parseInt(args[0]))) {
            count = parseInt(args[0]);
            spamContent = args.slice(1).join(' ');
        }
    }

    if (count <= 0 || !spamContent) {
        const errorMsg = `╭─〔 ⎔ *𝗦𝗣𝗔𝗠* ⎔ 〕
│ ⚠️ *𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗨𝗦𝗔𝗚𝗘*
│ 
│ *Reply to a message:*
│ .spam 5
│
│ *Or send text directly:*
│ .spam 5 Your Message
╰──────────────`;
        return await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
    }

    // Maximum limit can be added here if needed, but not specified. Let's keep it safe.
    if (count > 50) count = 50; // Sanity limit

    // Send the spam messages
    for (let i = 0; i < count; i++) {
        await sock.sendMessage(chatId, { text: spamContent });
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to prevent ban/rate limit
    }
};
