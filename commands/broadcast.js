const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../lib/isOwner');

/**
 * .broadcast command
 * Sends a message/media to all participating groups natively.
 */
async function broadcastCommand(sock, chatId, senderId, message, args) {
    try {
        console.log(`[BROADCAST] Command triggered by ${senderId}`);

        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            return await sock.sendMessage(chatId, { text: '❌ Only the bot owner or sudo can use this command' }, { quoted: message });
        }

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const textArg = args.join(' ').trim();

        if (!quoted && !textArg) {
            return await sock.sendMessage(chatId, { text: '❌ Please provide text or reply to a message/media to broadcast.' }, { quoted: message });
        }

        let mediaType = '';
        let mediaKey = null;
        let buffer = null;
        let statusText = textArg;

        if (quoted) {
            const contentUnpacked = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
            
            if (contentUnpacked.imageMessage) {
                mediaType = 'image';
                mediaKey = contentUnpacked.imageMessage;
            } else if (contentUnpacked.videoMessage) {
                mediaType = 'video';
                mediaKey = contentUnpacked.videoMessage;
            } else if (contentUnpacked.audioMessage) {
                mediaType = 'audio';
                mediaKey = contentUnpacked.audioMessage;
            } else {
                // Non-media message reply (text, link, etc.)
                const quotedText = contentUnpacked.conversation ||
                                   contentUnpacked.extendedTextMessage?.text ||
                                   contentUnpacked.text || '';
                statusText = textArg || quotedText;
            }
        }

        if (mediaKey) {
            await sock.sendMessage(chatId, { text: `⏳ Downloading media for broadcast...` }, { quoted: message });

            const stream = await downloadContentFromMessage(mediaKey, mediaType);
            buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (buffer.length === 0) {
                throw new Error('Downloaded media buffer is empty');
            }

            if (!statusText) {
                statusText = mediaKey.caption || '';
            }
        }

        console.log('[BROADCAST] Fetching participating groups for global broadcast...');
        const groupMetadata = await sock.groupFetchAllParticipating();
        const targetGroupJids = Object.keys(groupMetadata);
        
        if (targetGroupJids.length === 0) {
            return await sock.sendMessage(chatId, { text: '❌ The bot is not in any groups.' }, { quoted: message });
        }

        const startUI = `╭─〔 ⎔ *𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧* ⎔ 〕\n│ 🚀 *𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧𝗜𝗡𝗚...*\n│ 👥 *𝗧𝗔𝗥𝗚𝗘𝗧𝗦* : ${targetGroupJids.length} 𝗚𝗥𝗢𝗨𝗣𝗦\n│ 💀 *𝗕𝗢𝗧 𝗜𝗦 𝗧𝗔𝗞𝗜𝗡𝗚 𝗢𝗩𝗘𝗥...*`;
        await sock.sendMessage(chatId, { text: startUI }, { quoted: message });

        let successCount = 0;
        let failCount = 0;

        for (const targetJid of targetGroupJids) {
            try {
                if (buffer) {
                    if (mediaType === 'image') {
                        await sock.sendMessage(targetJid, { image: buffer, caption: statusText });
                    } else if (mediaType === 'video') {
                        await sock.sendMessage(targetJid, { video: buffer, caption: statusText });
                    } else if (mediaType === 'audio') {
                        await sock.sendMessage(targetJid, { audio: buffer, mimetype: mediaKey.mimetype || 'audio/mp4', ptt: mediaKey.ptt });
                    }
                } else {
                    await sock.sendMessage(targetJid, { text: statusText });
                }
                
                successCount++;
                
                // Add a minor delay between sends to prevent WhatsApp spam blocks
                if (targetGroupJids.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (err) {
                console.error(`[BROADCAST] Failed to send broadcast to ${targetJid}:`, err);
                failCount++;
            }
        }

        const endUI = `╭─〔 ⎔ *𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧* ⎔ 〕\n│ 👑 *𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘*\n│ 🟢 *𝗦𝗨𝗖𝗖𝗘𝗦𝗦* : ${successCount}\n│ 🔴 *𝗙𝗔𝗜𝗟𝗘𝗗* : ${failCount}\n│ 😈 *𝗠𝗜𝗦𝗦𝗜𝗢𝗡 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟*`;
        await sock.sendMessage(chatId, { text: endUI }, { quoted: message });

    } catch (error) {
        console.error('[BROADCAST] Critical Error:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed to broadcast message.\nError: ${error.message}` }, { quoted: message });
    }
}

module.exports = broadcastCommand;
