const { setAntiStatus, getAntiStatus, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntiStatusCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const isSenderSudo = await isSudo(senderId);
        if (!isSenderAdmin && !isSenderSudo) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        const args = userMessage.slice(8).toLowerCase().trim().split(' ').filter(Boolean);
        const action = args[0];

        if (action === 'on') {
            await setAntiStatus(chatId, true);
            const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🛡️ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡*\n│ ✦ *𝗦𝗧𝗔𝗧𝗨𝗦 𝗠𝗘𝗡𝗧𝗜𝗢𝗡𝗦 𝗕𝗟𝗢𝗖𝗞𝗘𝗗*\n╰──────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'off') {
            await setAntiStatus(chatId, false);
            const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗙𝗙*\n│ ✦ *𝗦𝗧𝗔𝗧𝗨𝗦 𝗠𝗘𝗡𝗧𝗜𝗢𝗡𝗦 𝗔𝗟𝗟𝗢𝗪𝗘𝗗*\n╰──────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antistatus command:', error);
    }
}

async function handleAntiStatusDetection(sock, chatId, message, senderId) {
    try {
        // Only run detection if message exists
        if (!message || !message.message) return;

        // Check if AntiStatus is enabled for this group
        const isEnabled = await getAntiStatus(chatId);
        if (!isEnabled) return;

        // Detect Status Mention
        // Baileys contextInfo.remoteJid === 'status@broadcast' for status replies
        const extendedTextMessage = message.message.extendedTextMessage;
        const contextInfo = extendedTextMessage?.contextInfo;
        
        let isStatusMention = false;
        
        if (contextInfo && contextInfo.remoteJid === 'status@broadcast') {
            isStatusMention = true;
        }
        
        // Check if the message is explicitly a group status mention
        if (message.message.groupStatusMentionMessage || message.message.statusMentionMessage) {
            isStatusMention = true;
        }
        
        // Log to find the exact structure if it's detected
        if (isStatusMention) {
            console.log('DEBUG MSG DETECTED STATUS MENTION (Exact Match)');
        }
        
        if (!isStatusMention) return;

        // Check if sender is admin or sudo/owner
        const adminData = await isAdmin(sock, chatId, senderId);
        const isSenderAdmin = adminData.isSenderAdmin;
        const isBotAdmin = adminData.isBotAdmin;
        const isSenderSudo = await isSudo(senderId);
        
        console.log(`DEBUG: senderId=${senderId}, isSenderAdmin=${isSenderAdmin}, isBotAdmin=${isBotAdmin}, isSudo=${isSenderSudo}, fromMe=${message.key.fromMe}`);
        
        // Never delete message from Admin or Owner/Sudo or the bot itself
        if (isSenderAdmin || isSenderSudo || message.key.fromMe) {
            console.log('DEBUG: Skipping delete due to admin/owner/fromMe');
            return;
        }
        
        // Sender is a normal member, delete the message
        if (isBotAdmin) {
            const deleteKey = { ...message.key };
            // If the message has a LID, use the standard JID for deletion if available
            if (deleteKey.participant && deleteKey.participant.endsWith('@lid') && deleteKey.participantAlt) {
                deleteKey.participant = deleteKey.participantAlt;
            }
            console.log('DEBUG: Attempting to delete message with key:', deleteKey);
            try {
                await sock.sendMessage(chatId, { delete: deleteKey });
                console.log('DEBUG: Delete successful');
            } catch(e) {
                console.log('DEBUG: Delete failed:', e);
            }
        } else {
            console.log('DEBUG: Bot is not admin, cannot delete');
        }
    } catch (error) {
        console.error('Error in antistatus detection:', error);
    }
}

module.exports = {
    handleAntiStatusCommand,
    handleAntiStatusDetection
};
