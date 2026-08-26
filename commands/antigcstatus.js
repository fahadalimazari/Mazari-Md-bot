const { setAntiGcStatus, getAntiGcStatus, isSudo, incrementWarningCount, resetWarningCount } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntiGcStatusCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const isSenderSudo = await isSudo(senderId);
        if (!isSenderAdmin && !isSenderSudo) {
            const ui = `╭─〔 ⎔ 𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗 ⎔ 〕\n│ 🔒 *𝗘𝗥𝗥𝗢𝗥* : *𝗨𝗦𝗘𝗥 𝗡𝗢𝗧 𝗔𝗗𝗠𝗜𝗡*\n│ ✦ *𝗦𝗼𝗿𝗿𝘆, 𝗼𝗻𝗹𝘆 𝗴𝗿𝗼𝘂𝗽 𝗮𝗱𝗺𝗶𝗻𝘀 𝗰𝗮𝗻 𝘂𝘀𝗲 𝘁𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱*\n╰──────────────────────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            return;
        }

        const args = userMessage.slice(13).toLowerCase().trim().split(' ').filter(Boolean);
        const action = args[0];

        if (action === 'del') {
            await setAntiGcStatus(chatId, 'del');
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ 🛡️ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡*\n│ ✦ *𝗠𝗼𝗱𝗲:* Delete Only\n╰──────────────────────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'warn') {
            await setAntiGcStatus(chatId, 'warn');
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ 🛡️ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡*\n│ ✦ *𝗠𝗼𝗱𝗲:* Delete & Warn (Kick on 3)\n╰──────────────────────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'kick') {
            await setAntiGcStatus(chatId, 'kick');
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ 🛡️ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡*\n│ ✦ *𝗠𝗼𝗱𝗲:* Delete & Kick instantly\n╰──────────────────────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'off') {
            await setAntiGcStatus(chatId, false);
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗙𝗙*\n│ ✦ *𝗚𝗥𝗢𝗨𝗣 𝗦𝗧𝗔𝗧𝗨𝗦 𝗔𝗟𝗟𝗢𝗪𝗘𝗗*\n╰──────────────────────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else {
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ ❌ *𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝗨𝘀𝗮𝗴𝗲*\n│ ✦ *𝗨𝘀𝗲:* .antigcstatus del/warn/kick/off\n╰──────────────────────────────`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antigcstatus command:', error);
    }
}

async function handleAntiGcStatusDetection(sock, chatId, message, senderId) {
    try {
        if (!message || !message.message) return;

        const action = await getAntiGcStatus(chatId);
        if (!action) return;

        let isGroupStatus = false;
        
        // Detect group status
        const msg = message.message;
        if (msg.groupStatusMessage || msg.groupStatusMessageV2) {
            isGroupStatus = true;
        } else if (msg.extendedTextMessage?.contextInfo?.isGroupStatus) {
            isGroupStatus = true;
        } else if (msg.imageMessage?.contextInfo?.isGroupStatus || msg.videoMessage?.contextInfo?.isGroupStatus || msg.audioMessage?.contextInfo?.isGroupStatus) {
            isGroupStatus = true;
        }
        
        if (!isGroupStatus) return;

        const adminData = await isAdmin(sock, chatId, senderId);
        const isBotAdmin = adminData.isBotAdmin;
        const isSenderSudo = await isSudo(senderId);
        
        // Never remove owner or bot
        if (isSenderSudo || message.key.fromMe) return;

        if (isBotAdmin) {
            const deleteKey = { ...message.key };
            if (deleteKey.participant && deleteKey.participant.endsWith('@lid') && deleteKey.participantAlt) {
                deleteKey.participant = deleteKey.participantAlt;
            }
            try {
                // Delete message
                await sock.sendMessage(chatId, { delete: deleteKey });
                
                if (action === 'kick') {
                    // Kick instantly
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    const uiText = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ 👢 *𝗠𝗲𝗺𝗯𝗲𝗿 𝗞𝗶𝗰𝗸𝗲𝗱!*\n│ 👤 @${senderId.split('@')[0]}\n│ ⚠️ *𝗥𝗲𝗮𝘀𝗼𝗻:* Sending Group Status\n╰──────────────────────────────`;
                    await sock.sendMessage(chatId, { text: uiText, mentions: [senderId] });
                } else if (action === 'warn') {
                    // Warn logic
                    const warnCount = await incrementWarningCount(chatId, senderId);
                    if (warnCount >= 3) {
                        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                        await resetWarningCount(chatId, senderId);
                        const uiText = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ 👢 *𝗠𝗲𝗺𝗯𝗲𝗿 𝗞𝗶𝗰𝗸𝗲𝗱!*\n│ 👤 @${senderId.split('@')[0]}\n│ ⚠️ *𝗥𝗲𝗮𝘀𝗼𝗻:* Reached 3 warnings for Group Status\n╰──────────────────────────────`;
                        await sock.sendMessage(chatId, { text: uiText, mentions: [senderId] });
                    } else {
                        const uiText = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜 𝗚𝗖 𝗦𝗧𝗔𝗧𝗨𝗦 ⎔ 〕\n│ ⚠️ *𝗪𝗮𝗿𝗻𝗶𝗻𝗴 ${warnCount}/3*\n│ 👤 @${senderId.split('@')[0]}\n│ ✦ *𝗗𝗼 𝗻𝗼𝘁 𝘀𝗲𝗻𝗱 𝗴𝗿𝗼𝘂𝗽 𝘀𝘁𝗮𝘁𝘂𝘀.*\n╰──────────────────────────────`;
                        await sock.sendMessage(chatId, { text: uiText, mentions: [senderId] });
                    }
                }
            } catch(e) {
                console.log('Error deleting/kicking for anti-gc-status:', e);
            }
        }
    } catch (error) {
        console.error('Error in antigcstatus detection:', error);
    }
}

module.exports = {
    handleAntiGcStatusCommand,
    handleAntiGcStatusDetection
};
