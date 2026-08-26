const isAdmin = require('../lib/isAdmin');
const settings = require('../settings');
const { getPdm } = require('../lib/index');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// Function to handle manual promotions via command
async function promoteCommand(sock, chatId, mentionedJids, message) {
    let userToPromote = [];
    
    // Check for mentioned users
    if (mentionedJids && mentionedJids.length > 0) {
        userToPromote = mentionedJids;
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    
    // If no user found through either method
    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: '╭─〔 ⎔ *𝗣𝗥𝗢𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ⚠️ *𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗢𝗥 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗔 𝗨𝗦𝗘𝗥*'
        });
        return;
    }

    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupCreator = jidNormalizedUser(groupMetadata.owner || groupMetadata.subjectOwner || "");
        
        // Robust Numeric Matching
        const cleanJid = (jid) => {
            if (!jid) return "";
            const raw = typeof jid === 'string' ? jid : (jid.id || jid.toString() || "");
            return raw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        };

        const ownerClean = settings.ownerNumber.replace(/[^0-9]/g, '');
        const multipleOwnersClean = (settings.ownerNumbers || []).map(num => num.replace(/[^0-9]/g, ''));
        const botClean = cleanJid(sock.user.id);
        const creatorClean = cleanJid(groupCreator);
        const senderClean = cleanJid(senderId);

        const isOwner = senderClean === ownerClean || 
                        senderClean === botClean || 
                        senderClean === creatorClean ||
                        multipleOwnersClean.includes(senderClean);

        // Standard admin check
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        // If NOT owner and NOT admin, block
        if (!isOwner && !isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗣𝗥𝗢𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦*' }, { quoted: message });
            return;
        }

        // Attempt promotion regardless of isBotAdmin status (User doesn't want the restriction message)
        try {
            await sock.groupParticipantsUpdate(chatId, userToPromote, "promote");
            
            // Success response
            const usernames = await Promise.all(userToPromote.map(async jid => `@${jid.split('@')[0]}`));
            const promoterJid = jidNormalizedUser(sock.user.id);
            
            const promotionMessage = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗣𝗥𝗢𝗠𝗢𝗧𝗜𝗢𝗡* ⎔ 〕\n│\n` +
                `│ 👤 *𝗣𝗥𝗢𝗠𝗢𝗧𝗘𝗗 :*\n│ ${usernames.map(name => `• ${name}`).join('\n│ ')}\n│\n` +
                `│ 👑 *𝗕𝗬 :* @${promoterJid.split('@')[0]}\n│ 📅 *𝗗𝗔𝗧𝗘 :* ${new Date().toLocaleString()}`;
            
            await sock.sendMessage(chatId, { 
                text: promotionMessage,
                mentions: [...userToPromote, promoterJid]
            });
        } catch (promoteError) {
            // Detailed error handling for protocol failures
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗣𝗥𝗢𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*' }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗣𝗥𝗢𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗣𝗥𝗢𝗠𝗢𝗧𝗘 𝗨𝗦𝗘𝗥*' }, { quoted: message });
            }
        }

    } catch (err) {
        console.error('Error in promote command logic:', err);
    }
}

// Function to handle automatic promotion detection
async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        const pdmEnabled = await getPdm(groupId);
        if (!pdmEnabled) return;

        if (!Array.isArray(participants) || participants.length === 0) return;

        const promotedUsernames = await Promise.all(participants.map(async jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]}`;
        }));

        let promotedBy = 'System';
        let mentionList = participants.map(jid => typeof jid === 'string' ? jid : (jid.id || jid.toString()));

        if (author) {
            const authorJid = typeof author === 'string' ? author : (author.id || author.toString());
            promotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        }

        const formattedDate = new Date().toLocaleString();

        const ui = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗣𝗥𝗢𝗠𝗢𝗧𝗜𝗢𝗡* ⎔ 〕\n│\n│ 👤 *𝗣𝗥𝗢𝗠𝗢𝗧𝗘𝗗* : ${promotedUsernames.join(', ')}\n│ 👑 *𝗕𝗬* : ${promotedBy}\n│ 📅 *𝗗𝗔𝗧𝗘* : ${formattedDate}`;
        
        await sock.sendMessage(groupId, {
            text: ui,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };
