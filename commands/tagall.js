const { getGroupMetadata } = require('../lib/myfunc');

async function tagAllCommand(sock, chatId, senderId, message) {
    console.log('Tagall command triggered by:', senderId, 'in chat:', chatId);
    try {
        // Get group metadata
        const groupMetadata = await getGroupMetadata(sock, chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            console.log('No participants found in group:', chatId);
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗧𝗔𝗚 𝗔𝗟𝗟* ⎔ 〕\n│ ❌ *𝗡𝗢 𝗣𝗔𝗥𝗧𝗜𝗖𝗜𝗣𝗔𝗡𝗧𝗦 𝗙𝗢𝗨𝗡𝗗*' });
            return;
        }

        console.log(`Fetched ${participants.length} participants for tagall in group:`, chatId);

        // Separate admins and members
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        const members = participants.filter(p => !p.admin);

        // Create message
        let messageText = '╭─〔 ⎔ *𝗧𝗔𝗚 𝗔𝗟𝗟* ⎔ 〕\n│\n│ 👑 ❮ *𝗔𝗗𝗠𝗜𝗡𝗦* ❯\n│\n';
        
        const adminEmojis = ['💖', '💕', '💗'];
        admins.forEach((admin, index) => {
            const emoji = adminEmojis[index % adminEmojis.length];
            messageText += `│ ${emoji} @${admin.id.split('@')[0]}\n`;
        });
        
        messageText += '│\n│ 🌸 ❮ *𝗠𝗘𝗠𝗕𝗘𝗥𝗦* ❯\n│\n';
        
        const memberEmojis = ['🦋', '🌷', '💐', '✨'];
        members.forEach((member, index) => {
            const emoji = memberEmojis[index % memberEmojis.length];
            messageText += `│ ${emoji} @${member.id.split('@')[0]}\n`;
        });
        messageText += '│';

        // Send message with mentions
        try {
            await sock.sendMessage(chatId, {
                text: messageText,
                mentions: participants.map(p => p.id)
            });
            console.log('Tagall message sent successfully with mentions');
        } catch (mentionError) {
            console.warn('Failed to send tagall with mentions, trying without:', mentionError);
            // Fallback: send message without mentions
            await sock.sendMessage(chatId, { text: messageText });
            console.log('Tagall fallback message sent without mentions');
        }

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗧𝗔𝗚 𝗔𝗟𝗟* ⎔ 〕\n│ ❌ *𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗧𝗔𝗚 𝗔𝗟𝗟 𝗠𝗘𝗠𝗕𝗘𝗥𝗦*' });
    }
}

module.exports = tagAllCommand;  // Export directly
