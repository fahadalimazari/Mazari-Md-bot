const { setAntiStatus, getAntiStatus, isSudo, incrementWarningCount, resetWarningCount } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntiStatusCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const { isSenderAdmin: freshIsSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, true);
        const isSenderSudo = await isSudo(senderId);
        const canExecute = isSenderAdmin || freshIsSenderAdmin || isSenderSudo;

        if (!canExecute) {
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗢𝗡𝗟𝗬* ⎔ 〕\n│ ⚠️ *𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗜𝗦 𝗙𝗢𝗥 𝗚𝗥𝗢𝗨𝗣 𝗔𝗗𝗠𝗜𝗡𝗦*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            return;
        }

        if (!isBotAdmin) {
            const ui = `╭─〔 ⎔ *𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗗* ⎔ 〕\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗧𝗛𝗘 𝗕𝗢𝗧 𝗔𝗡 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            return;
        }

        const parts = userMessage.trim().split(/\s+/);
        const action = parts[1] ? parts[1].toLowerCase() : '';

        if (!action || action === 'status') {
            const status = await getAntiStatus(chatId);
            if (!status || !status.enabled) {
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            } else {
                const modeLabel = (status.action || 'warn').toUpperCase();
                let ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *${modeLabel}*`;
                if (status.action === 'warn' || !status.action) {
                    ui += `\n│ ⚠️ *𝗟𝗜𝗠𝗜𝗧* : *𝟯 𝗪𝗔𝗥𝗡𝗜𝗡𝗚𝗦*`;
                }
                ui += `\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            }
            return;
        }

        switch (action) {
            case 'on': {
                await setAntiStatus(chatId, true, 'warn');
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *WARN*\n│ ⚠️ *𝗟𝗜𝗠𝗜𝗧* : *𝟯 𝗪𝗔𝗥𝗡𝗜𝗡𝗚𝗦*\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'warn': {
                await setAntiStatus(chatId, true, 'warn');
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *WARN*\n│ ⚠️ *𝗟𝗜𝗠𝗜𝗧* : *𝟯 𝗪𝗔𝗥𝗡𝗜𝗡𝗚𝗦*\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'delete':
            case 'del': {
                await setAntiStatus(chatId, true, 'delete');
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *DELETE*\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'kick': {
                await setAntiStatus(chatId, true, 'kick');
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *KICK*\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'off': {
                await setAntiStatus(chatId, false);
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            default: {
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗚𝗠 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ ❌ *𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗢𝗣𝗧𝗜𝗢𝗡*\n│ ⟡ *𝗨𝗦𝗘* : \`.antigm on\`\n│ ⟡ *𝗨𝗦𝗘* : \`.antigm warn\`\n│ ⟡ *𝗨𝗦𝗘* : \`.antigm delete\`\n│ ⟡ *𝗨𝗦𝗘* : \`.antigm kick\`\n│ ⟡ *𝗨𝗦𝗘* : \`.antigm off\`\n╰────────────────╯`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }
        }
    } catch (error) {
        console.error('Error in antistatus/antigm command:', error);
    }
}

async function handleAntiStatusDetection(sock, chatId, message, senderId) {
    try {
        // Only run detection if message exists
        if (!message || !message.message) return;

        // Check if AntiStatus/AntiGM is enabled for this group
        const antiConfig = await getAntiStatus(chatId);
        if (!antiConfig || !antiConfig.enabled) return;

        // Detect Status Mention / Group Mention
        const msg = message.message;
        const extendedTextMessage = msg.extendedTextMessage;
        const contextInfo = extendedTextMessage?.contextInfo;
        
        let isStatusMention = false;
        
        if (contextInfo && contextInfo.remoteJid === 'status@broadcast') {
            isStatusMention = true;
        }
        
        // Check if the message is explicitly a group status mention
        if (msg.groupStatusMentionMessage || msg.statusMentionMessage || msg.groupStatusMessage || msg.groupStatusMessageV2) {
            isStatusMention = true;
        }

        if (msg.imageMessage?.contextInfo?.remoteJid === 'status@broadcast' || 
            msg.videoMessage?.contextInfo?.remoteJid === 'status@broadcast' || 
            msg.audioMessage?.contextInfo?.remoteJid === 'status@broadcast' ||
            msg.documentMessage?.contextInfo?.remoteJid === 'status@broadcast') {
            isStatusMention = true;
        }
        
        if (!isStatusMention) return;

        // Check if sender is admin or sudo/owner
        const adminData = await isAdmin(sock, chatId, senderId);
        const isSenderAdmin = adminData.isSenderAdmin;
        const isBotAdmin = adminData.isBotAdmin;
        const isSenderSudo = await isSudo(senderId);
        
        // Never delete/punish Admin or Owner/Sudo or the bot itself
        if (isSenderAdmin || isSenderSudo || message.key.fromMe) {
            return;
        }
        
        if (!isBotAdmin) {
            return;
        }

        const deleteKey = { ...message.key };
        if (deleteKey.participant && deleteKey.participant.endsWith('@lid') && deleteKey.participantAlt) {
            deleteKey.participant = deleteKey.participantAlt;
        }

        const mode = (antiConfig.action || 'warn').toLowerCase();

        if (mode === 'delete' || mode === 'del') {
            // Delete offending message
            try {
                await sock.sendMessage(chatId, { delete: deleteKey });
            } catch (e) {
                console.error('AntiGM delete error:', e.message);
            }
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜𝗚𝗠 ⎔ 〕\n│ 🗑️ 𝗔𝗖𝗧𝗜𝗢𝗡 : 𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗗𝗘𝗟𝗘𝗧𝗘𝗗\n╰────────────────╯`;
            try {
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            } catch (e) {
                await sock.sendMessage(chatId, { text: ui });
            }
            return;
        }

        if (mode === 'kick') {
            // Delete offending message first
            try {
                await sock.sendMessage(chatId, { delete: deleteKey });
            } catch (e) {
                console.error('AntiGM delete error:', e.message);
            }
            // Immediately kick the user
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            } catch (e) {
                console.error('AntiGM kick error:', e.message);
            }
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜𝗚𝗠 ⎔ 〕\n│ 👢 𝗔𝗖𝗧𝗜𝗢𝗡 : 𝗨𝗦𝗘𝗥 𝗞𝗜𝗖𝗞𝗘𝗗\n╰────────────────╯`;
            try {
                await sock.sendMessage(chatId, { text: ui, mentions: [senderId] }, { quoted: message });
            } catch (e) {
                await sock.sendMessage(chatId, { text: ui, mentions: [senderId] });
            }
            return;
        }

        // Default: WARN mode
        // Delete offending message
        try {
            await sock.sendMessage(chatId, { delete: deleteKey });
        } catch (e) {
            console.error('AntiGM delete error:', e.message);
        }

        const warnCount = await incrementWarningCount(chatId, senderId);
        const userTag = `@${senderId.split('@')[0].split(':')[0]}`;

        if (warnCount >= 3) {
            // 3rd violation: Kick immediately and reset warning counter
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            } catch (e) {
                console.error('AntiGM kick error on 3rd warning:', e.message);
            }
            await resetWarningCount(chatId, senderId);

            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜𝗚𝗠 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 ⎔ 〕\n│ ⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 : 𝟯/𝟯\n│ 🗑️ 𝗠𝗘𝗦𝗦𝗔𝗚𝗘 : 𝗗𝗘𝗟𝗘𝗧𝗘𝗗\n│ 👢 𝗔𝗖𝗧𝗜𝗢𝗡 : 𝗨𝗦𝗘𝗥 𝗞𝗜𝗖𝗞𝗘𝗗\n╰────────────────╯`;
            try {
                await sock.sendMessage(chatId, { text: ui, mentions: [senderId] }, { quoted: message });
            } catch (e) {
                await sock.sendMessage(chatId, { text: ui, mentions: [senderId] });
            }
        } else {
            const boldMap = { 1: '𝟭', 2: '𝟮', 3: '𝟯' };
            const numStr = boldMap[warnCount] || warnCount;
            const ui = `╭─〔 ⎔ 𝗔𝗡𝗧𝗜𝗚𝗠 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 ⎔ 〕\n│ ⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 : ${numStr}/𝟯\n│ 👤 𝗨𝗦𝗘𝗥 : ${userTag}\n╰────────────────╯`;
            try {
                await sock.sendMessage(chatId, { text: ui, mentions: [senderId] }, { quoted: message });
            } catch (e) {
                await sock.sendMessage(chatId, { text: ui, mentions: [senderId] });
            }
        }
    } catch (error) {
        console.error('Error in antistatus detection:', error);
    }
}

module.exports = {
    handleAntiStatusCommand,
    handleAntiStatusDetection
};
