const { loadUserGroupData, resetWarningCount } = require('../lib/index');

async function handleRestwarnCommand(sock, chatId, userMessage, senderId, _cachedIsSenderAdmin, message, mentionedJids) {
    try {
        // Fetch fresh group metadata to avoid cached role issues
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Normalize sender and bot numbers
        const senderNumber = senderId.includes(':') ? senderId.split(':')[0] : (senderId.includes('@') ? senderId.split('@')[0] : senderId);
        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botNumber = botId.includes(':') ? botId.split(':')[0] : (botId.includes('@') ? botId.split('@')[0] : botId);
        const botIdWithoutSuffix = botId.includes('@') ? botId.split('@')[0] : botId;
        
        const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
        const botLidWithoutSuffix = botLid.includes('@') ? botLid.split('@')[0] : botLid;

        let isSenderAdmin = false;
        let isBotAdmin = false;

        for (const p of participants) {
            const pId = p.id || '';
            const pLid = p.lid || '';
            const pNumber = pId.split('@')[0];
            const pLidNumber = pLid.split('@')[0];
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;

            if (pNumber === senderNumber || pLidNumber === senderNumber) {
                if (p.admin === 'admin' || p.admin === 'superadmin') isSenderAdmin = true;
            }

            const botMatches = (
                botId === pId || 
                botId === pLid || 
                botLid === pLid || 
                botLidNumeric === pLidNumeric || 
                botLidWithoutSuffix === pLid || 
                botNumber === pPhoneNumber || 
                botNumber === pNumber || 
                botIdWithoutSuffix === pPhoneNumber || 
                botIdWithoutSuffix === pNumber || 
                (botLid && botLid.split('@')[0].split(':')[0] === pLid)
            );

            if (botMatches) {
                if (p.admin === 'admin' || p.admin === 'superadmin') isBotAdmin = true;
            }
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '```Please make the bot an admin first!```' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        let targetUser = null;

        // 1. Check for mentions
        if (mentionedJids && mentionedJids.length > 0) {
            targetUser = mentionedJids[0];
        }
        // 2. Check for reply
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            targetUser = message.message.extendedTextMessage.contextInfo.participant;
        }
        // 3. Check for number in arguments
        else {
            const args = userMessage.split(' ').slice(1);
            if (args.length > 0) {
                let number = args[0].replace(/[^0-9]/g, '');
                if (number) {
                    targetUser = `${number}@s.whatsapp.net`;
                }
            }
        }

        if (!targetUser) {
            await sock.sendMessage(chatId, { text: '❌ Please reply to a user, mention them, or provide their number to reset their warnings.' }, { quoted: message });
            return;
        }

        const data = loadUserGroupData();
        const currentWarnings = data.warnings?.[chatId]?.[targetUser] || 0;

        if (currentWarnings === 0) {
            await sock.sendMessage(chatId, { text: `*_@${targetUser.split('@')[0]}'s warnings are already 0._*`, mentions: [targetUser] }, { quoted: message });
            return;
        }

        await resetWarningCount(chatId, targetUser);

        const ui = `╭─〔 ⎔ *𝗪𝗔𝗥𝗡𝗜𝗡𝗚 𝗥𝗘𝗦𝗘𝗧* ⎔ 〕\n│ 👤 *𝗨𝗦𝗘𝗥* : @${targetUser.split('@')[0]}\n│ 🔄 *𝗪𝗔𝗥𝗡𝗜𝗡𝗚𝗦* : *𝟬/𝟯*\n│ ✓ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗥𝗘𝗦𝗘𝗧*`;

        await sock.sendMessage(chatId, { 
            text: ui, 
            mentions: [targetUser] 
        }, { quoted: message });

    } catch (error) {
        console.error('Error in restwarn command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing restwarn command_*' }, { quoted: message });
    }
}

module.exports = {
    handleRestwarnCommand
};
