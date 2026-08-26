const isAdmin = require('../lib/isAdmin');

async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    const isOwner = message.key.fromMe;
    if (!isOwner) {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗞𝗜𝗖𝗞* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗞𝗜𝗖𝗞* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗*' }, { quoted: message });
            return;
        }
    }

    let usersToKick = [];
    
    // 1. Get from mentioned JIDs
    if (mentionedJids && mentionedJids.length > 0) {
        usersToKick = [...new Set(mentionedJids)];
    }
    
    // 2. Get from reply (contextInfo)
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant) {
        if (!usersToKick.includes(contextInfo.participant)) {
            usersToKick.push(contextInfo.participant);
        }
    }
    
    // 3. Get from text (numbers)
    const textArgs = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').split(/\s+/).slice(1);
    for (const arg of textArgs) {
        if (arg.length > 5 && !isNaN(arg.replace(/[^0-9]/g, ''))) {
            const jid = arg.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!usersToKick.includes(jid)) {
                usersToKick.push(jid);
            }
        }
    }

    if (usersToKick.length === 0) {
        await sock.sendMessage(chatId, { 
            text: '╭─〔 ⎔ *𝗞𝗜𝗖𝗞* ⎔ 〕\n│ ⚠️ *𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗢𝗥 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗔 𝗨𝗦𝗘𝗥*'
        }, { quoted: message });
        return;
    }

    const botId = sock.user?.id || '';
    const botLid = sock.user?.lid || '';
    const botPhoneNumber = botId.includes(':') ? botId.split(':')[0] : (botId.includes('@') ? botId.split('@')[0] : botId);
    const botIdFormatted = botPhoneNumber + '@s.whatsapp.net';
    
    // Extract numeric part from bot LID (remove session identifier like :4)
    const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
    const botLidWithoutSuffix = botLid.includes('@') ? botLid.split('@')[0] : botLid;

    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants || [];

    const isTryingToKickBot = usersToKick.some(userId => {
        const userPhoneNumber = userId.includes(':') ? userId.split(':')[0] : (userId.includes('@') ? userId.split('@')[0] : userId);
        const userLidNumeric = userId.includes('@lid') ? userId.split('@')[0].split(':')[0] : '';
        
        // Direct match checks
        const directMatch = (
            userId === botId ||
            userId === botLid ||
            userId === botIdFormatted ||
            userPhoneNumber === botPhoneNumber ||
            (userLidNumeric && botLidNumeric && userLidNumeric === botLidNumeric)
        );
        
        if (directMatch) {
            return true;
        }
        
        // Check against participants
        const participantMatch = participants.some(p => {
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pId = p.id ? p.id.split('@')[0] : '';
            const pLid = p.lid ? p.lid.split('@')[0] : '';
            const pFullId = p.id || '';
            const pFullLid = p.lid || '';
            
            // Extract numeric part from participant LID
            const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;
            
            // Check if this participant is the bot
            const isThisParticipantBot = (
                pFullId === botId ||
                pFullLid === botLid ||
                pLidNumeric === botLidNumeric ||
                pPhoneNumber === botPhoneNumber ||
                pId === botPhoneNumber ||
                p.phoneNumber === botIdFormatted ||
                (botLid && pLid && botLidWithoutSuffix === pLid)
            );
            
            if (isThisParticipantBot) {
                // Check if the userId matches this bot participant
                return (
                    userId === pFullId ||
                    userId === pFullLid ||
                    userPhoneNumber === pPhoneNumber ||
                    userPhoneNumber === pId ||
                    userId === p.phoneNumber ||
                    (pLid && userLidNumeric && userLidNumeric === pLidNumeric) ||
                    (userLidNumeric && pLidNumeric && userLidNumeric === pLidNumeric)
                );
            }
            return false;
        });
        
        return participantMatch;
    });

    if (isTryingToKickBot) {
        await sock.sendMessage(chatId, { 
            text: "╭─〔 ⎔ *𝗞𝗜𝗖𝗞* ⎔ 〕\n│ 🤖 *𝗜 𝗖𝗔𝗡'𝗧 𝗞𝗜𝗖𝗞 𝗠𝗬𝗦𝗘𝗟𝗙*"
        }, { quoted: message });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");
        
        const usernames = await Promise.all(usersToKick.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));
        
        await sock.sendMessage(chatId, { 
            text: `╭─〔 ⎔ *𝗞𝗜𝗖𝗞* ⎔ 〕\n│ 👢 *𝗞𝗜𝗖𝗞𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*\n│ 👤 ${usernames.join(', ')}`,
            mentions: usersToKick
        });
    } catch (error) {
        console.error('Error in kick command:', error);
        await sock.sendMessage(chatId, { 
            text: '╭─〔 ⎔ *𝗞𝗜𝗖𝗞* ⎔ 〕\n│ ❌ *𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗞𝗜𝗖𝗞 𝗨𝗦𝗘𝗥(𝗦)*'
        });
    }
}

module.exports = kickCommand;
