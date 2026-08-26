const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '',
            newsletterName: 'MAZARI MD',
            serverMessageId: -1
        }
    }
};

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const sessionId = getSessionId(sock);
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!msg.key.fromMe && !isOwner) {
            const ui = `╭─〔 ⎔ *𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗* ⎔ 〕\n│ 🔒 *𝗘𝗥𝗥𝗢𝗥* : *𝗢𝗪𝗡𝗘𝗥 𝗢𝗡𝗟𝗬*\n│ ✦ *This command can only be used by the owner*\n╰──────────────`;
            await sock.sendMessage(chatId, { text: ui, ...channelInfo }, { quoted: msg });
            return;
        }

        // Read current config
        let config = readSessionData(sessionId, 'autoStatus.json', { enabled: false, reactOn: false });

        // If no arguments, show current status
        if (!args || args.length === 0) {
            const status = config.enabled ? 'enabled' : 'disabled';
            const reactStatus = config.reactOn ? 'enabled' : 'disabled';
            const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕─╮\n│ 📱 *𝗩𝗶𝗲𝘄* : *${status.toUpperCase()}*\n│ 💫 *𝗥𝗲𝗮𝗰𝘁* : *${reactStatus.toUpperCase()}*\n│\n│ *Commands:*\n│ ✦ .statusseen on/off\n│ ✦ .statusseen react on/off\n╰─────────────────────╯`;
            await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
            return;
        }

        // Handle on/off commands
        const command = args[0].toLowerCase();

        if (command === 'on') {
            config.enabled = true;
            writeSessionData(sessionId, 'autoStatus.json', config);
            const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦 𝗦𝗘𝗘𝗡* ⎔ 〕─╮\n│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗡* ✓\n╰─────────────────────╯`;
            await sock.sendMessage(chatId, {
                text: uiText,
                ...channelInfo
            });
        } else if (command === 'off') {
            config.enabled = false;
            writeSessionData(sessionId, 'autoStatus.json', config);
            const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦 𝗦𝗘𝗘𝗡* ⎔ 〕─╮\n│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗢𝗙𝗙* ✓\n╰─────────────────────╯`;
            await sock.sendMessage(chatId, {
                text: uiText,
                ...channelInfo
            });
        } else if (command === 'react') {
            // Handle react subcommand
            if (!args[1]) {
                const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕─╮\n│ ❌ *Please specify on/off*\n│ ✦ *Use:* .statusseen react on/off\n╰─────────────────────╯`;
                await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
                return;
            }

            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') {
                config.reactOn = true;
                writeSessionData(sessionId, 'autoStatus.json', config);
                const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕─╮\n│ 💫 *𝗥𝗘𝗔𝗖𝗧𝗜𝗢𝗡𝗦* : *𝗢𝗡* ✓\n╰─────────────────────╯`;
                await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
            } else if (reactCommand === 'off') {
                config.reactOn = false;
                writeSessionData(sessionId, 'autoStatus.json', config);
                const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕─╮\n│ 💫 *𝗥𝗘𝗔𝗖𝗧𝗜𝗢𝗡𝗦* : *𝗢𝗙𝗙* ✕\n╰─────────────────────╯`;
                await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
            } else {
                const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕─╮\n│ ❌ *Invalid reaction command!*\n│ ✦ *Use:* .statusseen react on/off\n╰─────────────────────╯`;
                await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
            }
        } else {
            const uiText = `â•­â”€ã€” âŽ” *ð—”ð—¨ð—§ð—¢ ð—¦ð—§ð—”ð—§ð—¨ð—¦* âŽ” ã€•â”€â•®\nâ”‚ âŒ *Invalid command!*\nâ”‚ âœ¦ .statusseen on/off\nâ”‚ âœ¦ .statusseen react on/off\nâ•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
            await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
        }

    } catch (error) {
        console.error('Error in autostatus command:', error);
        const uiText = `â•­â”€ã€” âŽ” *ð—”ð—¨ð—§ð—¢ ð—¦ð—§ð—”ð—§ð—¨ð—¦* âŽ” ã€•â”€â•®\nâ”‚ âŒ *ð—˜ð—¥ð—¥ð—¢ð—¥ ð—¢ð—–ð—–ð—¨ð—¥ð—¥ð—˜ð——*\nâ”‚ âœ¦ ${error.message}\nâ•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
        await sock.sendMessage(chatId, { text: uiText, ...channelInfo });
    }
}

// Function to check if auto status is enabled
function isAutoStatusEnabled(sessionId) {
    try {
        const config = readSessionData(sessionId, 'autoStatus.json', { enabled: false, reactOn: false });
        return config.enabled;
    } catch (error) {
        console.error('Error checking auto status config:', error);
        return false;
    }
}

// Function to check if status reactions are enabled
function isStatusReactionEnabled(sessionId) {
    try {
        const config = readSessionData(sessionId, 'autoStatus.json', { enabled: false, reactOn: false });
        return config.reactOn;
    } catch (error) {
        console.error('Error checking status reaction config:', error);
        return false;
    }
}

// Function to react to status using proper method
async function reactToStatus(sock, msg) {
    try {
        const sessionId = getSessionId(sock);
        if (!isStatusReactionEnabled(sessionId)) {
            return;
        }

        const statusKey = msg.key;
        const participant = statusKey.participant;
        if (!participant) return;

        // In WhatsApp, reacting to a status actually sends a DM with the emoji, quoting the status
        await sock.sendMessage(participant, {
            text: '💚'
        }, {
            quoted: msg
        });

        // Removed success log - only keep errors
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

const { loadUserGroupData, getStatusRestriction } = require('../lib/index');

// Function to handle status updates and check for restricted mentions
async function handleStatusUpdate(sock, status) {
    try {
        const sessionId = getSessionId(sock);
        // Fast paths: skip if no status message
        if (!status.messages || status.messages.length === 0) return;
        const msg = status.messages[0];
        if (msg.key?.remoteJid !== 'status@broadcast') return;

        const sender = msg.key.participant || msg.key.remoteJid;
        console.log(`📡 [STATUS-LOG] Received status update from: ${sender}`);

        const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';

        // 1. Process Auto-View
        if (isAutoStatusEnabled(sessionId)) {
            try {
                await sock.readMessages([msg.key]);
            } catch (e) { }
        }

        // 2. Status Mention Restriction Check
        const data = loadUserGroupData();
        const restrictedGroups = Object.keys(data.statusRestriction || {}).filter(gid => data.statusRestriction[gid] === false);

        if (restrictedGroups.length === 0) return;

        // Check content for mentions or links
        let rawText = (msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || '').toLowerCase();

        console.log(`ðŸ“ [STATUS-TEXT] From: ${sender} | Content: "${rawText}"`);

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isBotMentioned = mentions.includes(botId);

        // Regex for WhatsApp group links
        const hasGroupLink = /chat\.whatsapp\.com\/[a-zA-Z0-9]+/i.test(rawText) || rawText.includes('whatsapp.com/g/');

        if (isBotMentioned || hasGroupLink) {
            console.log(`ðŸŽ¯ [STATUS-TRIGGER] Match found! BotMention=${isBotMentioned}, Link=${hasGroupLink} from ${sender}`);

            for (const groupId of restrictedGroups) {
                try {
                    const groupMetadata = await sock.groupMetadata(groupId);

                    // Verify Bot Admin Status
                    const normalizedBotId = botId.split('@')[0];
                    const botHandle = groupMetadata.participants.find(p => p.id.split('@')[0] === normalizedBotId);
                    const isBotAdmin = botHandle?.admin || botHandle?.isAdmin || false;

                    if (!isBotAdmin) {
                        console.warn(`âš ï¸ [STATUS] Bot not admin in ${groupId}. Cannot kick ${sender}.`);
                        continue;
                    }

                    const senderNum = sender.split('@')[0];
                    const participant = groupMetadata.participants.find(p => {
                        const pid = p.id.split('@')[0];
                        const plid = p.lid ? p.lid.split('@')[0] : '';
                        return pid === senderNum || plid === senderNum;
                    });

                    if (participant) {
                        const targetJid = participant.id;
                        console.log(`ðŸ‘¢ [KICK] Removing member ${targetJid} (Status from ${sender}) from ${groupId} for status violation.`);

                        // KICK THE MEMBER (Use their real group JID)
                        await sock.groupParticipantsUpdate(groupId, [targetJid], 'remove');
                        const uiText = `â•­â”€ã€” âŽ” *ð—”ð—¡ð—§ð—œ ð—¦ð—§ð—”ð—§ð—¨ð—¦ ð— ð—˜ð—¡ð—§ð—œð—¢ð—¡* âŽ” ã€•â”€â•®\nâ”‚ ðŸ‘¢ *ð— ð—²ð—ºð—¯ð—²ð—¿ ð—žð—¶ð—°ð—¸ð—²ð—±!* \nâ”‚ ðŸ‘¤ @${targetJid.split('@')[0]}\nâ”‚ âš ï¸ *ð—¥ð—²ð—®ð˜€ð—¼ð—»:* Status Mention Policy Violation\nâ•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
                        await sock.sendMessage(groupId, {
                            text: uiText,
                            mentions: [targetJid]
                        });
                    } else {
                        // Optional: console.log(`â„¹ï¸ [DEBUG] Sender ${sender} was not found in group ${groupId}.`);
                    }
                } catch (err) {
                    console.error(`âŒ [ERROR] Enforcing status restriction in ${groupId}:`, err.message);
                }
            }
        }
    } catch (error) {
        console.error('âŒ [ERROR] handleStatusUpdate:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
}; 
