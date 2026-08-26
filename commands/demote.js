const isAdmin = require('../lib/isAdmin');
const { getPdm } = require('../lib/index');

async function demoteCommand(sock, chatId, mentionedJids, message) {
    try {
        // First check if it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '╭─〔 ⎔ *𝗗𝗘𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗪𝗢𝗥𝗞𝗦 𝗢𝗡𝗟𝗬 𝗜𝗡 𝗚𝗥𝗢𝗨𝗣𝗦*'
            });
            return;
        }

        // Check admin status first, before any other operations
        try {
            const adminStatus = await isAdmin(sock, chatId, message.key.participant || message.key.remoteJid);
            
            if (!adminStatus.isBotAdmin) {
                await sock.sendMessage(chatId, { 
                    text: '╭─〔 ⎔ *𝗗𝗘𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*'
                });
                return;
            }

            if (!adminStatus.isSenderAdmin) {
                await sock.sendMessage(chatId, { 
                    text: '╭─〔 ⎔ *𝗗𝗘𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗*'
                });
                return;
            }
        } catch (adminError) {
            console.error('Error checking admin status:', adminError);
            await sock.sendMessage(chatId, { 
                text: '╭─〔 ⎔ *𝗗𝗘𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*'
            });
            return;
        }

        let userToDemote = [];
        
        // Check for mentioned users
        if (mentionedJids && mentionedJids.length > 0) {
            userToDemote = mentionedJids;
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
        }
        
        // If no user found through either method
        if (userToDemote.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '╭─〔 ⎔ *𝗗𝗘𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ⚠️ *𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗢𝗥 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗔 𝗨𝗦𝗘𝗥*'
            });
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        await sock.groupParticipantsUpdate(chatId, userToDemote, "demote");
        
        // Get usernames for each demoted user
        const usernames = await Promise.all(userToDemote.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const demotionMessage = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗗𝗘𝗠𝗢𝗧𝗜𝗢𝗡* ⎔ 〕\n│\n` +
            `│ 👤 *𝗗𝗘𝗠𝗢𝗧𝗘𝗗 :*\n│ ${usernames.map(name => `• ${name}`).join('\n│ ')}\n│\n` +
            `│ 👑 *𝗕𝗬 :* @${message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid.split('@')[0]}\n│ 📅 *𝗗𝗔𝗧𝗘 :* ${new Date().toLocaleString()}`;
        
        await sock.sendMessage(chatId, { 
            text: demotionMessage,
            mentions: [...userToDemote, message.key.participant || message.key.remoteJid]
        });
    } catch (error) {
        console.error('Error in demote command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: '❌ Rate limit reached. Please try again in a few seconds.'
                });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: '╭─〔 ⎔ *𝗗𝗘𝗠𝗢𝗧𝗘* ⎔ 〕\n│ ❌ *𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗗𝗘𝗠𝗢𝗧𝗘 𝗨𝗦𝗘𝗥*'
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

// Function to handle automatic demotion detection
async function handleDemotionEvent(sock, groupId, participants, author) {
    try {
        const pdmEnabled = await getPdm(groupId);
        if (!pdmEnabled) return;

        // Safety check for participants
        if (!Array.isArray(participants) || participants.length === 0) {
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const demotedUsernames = participants.map(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]}`;
        }).join(', ');

        let demotedBy;
        let mentionList = participants.map(jid => {
            return typeof jid === 'string' ? jid : (jid.id || jid.toString());
        });

        if (author && author.length > 0) {
            const authorJid = typeof author === 'string' ? author : (author.id || author.toString());
            demotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        } else {
            demotedBy = 'System';
        }

        const formattedDate = new Date().toLocaleString();

        const ui = `╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗗𝗘𝗠𝗢𝗧𝗜𝗢𝗡* ⎔ 〕\n│\n│ 👤 *𝗗𝗘𝗠𝗢𝗧𝗘𝗗* : ${demotedUsernames}\n│ 👑 *𝗕𝗬* : ${demotedBy}\n│ 📅 *𝗗𝗔𝗧𝗘* : ${formattedDate}`;
        
        await sock.sendMessage(groupId, {
            text: ui,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling demotion event:', error);
    }
}

module.exports = { demoteCommand, handleDemotionEvent };
