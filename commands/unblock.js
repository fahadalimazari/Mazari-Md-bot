const isOwnerOrSudo = require('../lib/isOwner');

/**
 * Handle the .unblock command
 */
async function unblockCommand(sock, chatId, message, args = []) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        // Ensure owner/sudo
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!message.key.fromMe && !isOwner) {
            return sock.sendMessage(chatId, {
                text: '╭─〔 ⎔ 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 ⎔ 〕─\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗗𝗘𝗡𝗜𝗘𝗗 ✗\n│ 𝗥𝗘𝗔𝗦𝗢𝗡 : 𝗢𝗪𝗡𝗘𝗥 / 𝗦𝗨𝗗𝗢 𝗢𝗡𝗟𝗬\n╰────────────────────╯'
            });
        }

        let targetJid = null;

        // 1. Group reply
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo;
        if (quotedMsg && quotedMsg.participant) {
            targetJid = quotedMsg.participant;
        }
        // 2. Direct number argument
        else if (args.length > 0) {
            let number = args.join('').replace(/[^0-9]/g, '');
            if (number.length > 0) {
                targetJid = `${number}@s.whatsapp.net`;
            }
        }
        // 3. Inbox chat
        else if (!isGroup) {
            targetJid = chatId;
        }

        if (!targetJid) {
            return sock.sendMessage(chatId, {
                text: '╭─〔 ⎔ 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 ⎔ 〕─\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 ✗\n│ 𝗥𝗘𝗔𝗦𝗢𝗡 : 𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗧𝗔𝗥𝗚𝗘𝗧\n╰────────────────────╯'
            });
        }

        // Prevent targeting the bot itself or a group
        if (targetJid.includes(sock.user.id.split(':')[0]) || targetJid.endsWith('@g.us')) {
            return sock.sendMessage(chatId, {
                text: '╭─〔 ⎔ 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 ⎔ 〕─\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 ✗\n│ 𝗥𝗘𝗔𝗦𝗢𝗡 : 𝗖𝗔𝗡𝗡𝗢𝗧 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 𝗧𝗛𝗜𝗦 𝗝𝗜𝗗\n╰────────────────────╯'
            });
        }

        try {
            console.log('[UNBLOCK] target JID:', targetJid);
            console.log('[UNBLOCK] sessionId:', sock?.user?.id);

            const result = await sock.updateBlockStatus(targetJid, 'unblock');
            
            console.log('[UNBLOCK] success:', result);

            return sock.sendMessage(chatId, {
                text: `╭─〔 ⎔ 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 ⎔ 〕─\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗨𝗡𝗕𝗟𝗢𝗖𝗞𝗘𝗗 ✓\n│ 𝗨𝗦𝗘𝗥 : @${targetJid.split('@')[0]}\n╰────────────────────╯`,
                mentions: [targetJid]
            });
        } catch (apiErr) {
            console.error('[UNBLOCK] FAILED:', apiErr);
            console.error('[UNBLOCK] message:', apiErr?.message);
            console.error('[UNBLOCK] stack:', apiErr?.stack);
            
            return sock.sendMessage(chatId, {
                text: '╭─〔 ⎔ 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 ⎔ 〕─\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗙𝗔𝗜𝗟𝗘𝗗 ✗\n│ 𝗥𝗘𝗔𝗦𝗢𝗡 : 𝗨𝗡𝗕𝗟𝗢𝗖𝗞 𝗙𝗔𝗜𝗟𝗘𝗗\n╰────────────────────╯'
            });
        }

    } catch (error) {
        console.error(`[UNBLOCK FATAL ERROR]`, error);
    }
}

module.exports = unblockCommand;
