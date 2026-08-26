const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');
const fetch = require('node-fetch');
const { getGroupMetadata } = require('../lib/myfunc');

async function welcomeCommand(sock, chatId, message, match) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗢𝗡𝗟𝗬* ⎔ 〕\n│ ⚠️ *This command can only be used in groups!*\n╰──────────────────────────────' });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    // Check if welcome is enabled for this group
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    // Get custom welcome message
    const customMessage = await getWelcome(id);

    // Get group metadata
    const groupMetadata = await getGroupMetadata(sock, id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';

    // Send welcome message for each new participant
    for (const participant of participants) {
        try {
            // Handle case where participant might be an object or not a string
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const user = participantString.split('@')[0];
            
            // Get user's display name
            let displayName = user; // Default to phone number
            try {
                const contact = await sock.getBusinessProfile(participantString);
                if (contact && contact.name) {
                    displayName = contact.name;
                } else {
                    // Try to get from group participants
                    const groupParticipants = groupMetadata.participants;
                    const userParticipant = groupParticipants.find(p => p.id === participantString);
                    if (userParticipant && userParticipant.name) {
                        displayName = userParticipant.name;
                    }
                }
            } catch (nameError) {
                console.log('Could not fetch display name, using phone number');
            }
            
            // Process custom message with variables
            let finalMessage = (customMessage && customMessage.trim() !== '') ? customMessage : '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ 🎉 *Welcome @{user}! Glad to have you here.*';
            
            finalMessage = finalMessage
                .replace(/{user}/g, displayName)
                .replace(/{group}/g, groupName)
                .replace(/{description}/g, groupDesc);
                
            // Ensure the user is properly mentioned if @username is in the text
            if (finalMessage.includes(`@${displayName}`)) {
                // The @ is already there, we just need to ensure mentions array is correct
            } else if (finalMessage.includes(displayName)) {
                // Prepend @ if it's missing but user is mentioned
                finalMessage = finalMessage.replace(displayName, `@${displayName}`);
            }

            // Send simple text message
            await sock.sendMessage(id, {
                text: finalMessage,
                mentions: [participantString],
                ...channelInfo
            });
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
