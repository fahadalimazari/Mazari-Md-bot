const fs = require('fs');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');

async function banCommand(sock, chatId, message) {
    // Restrict in groups to admins; in private to owner/sudo
    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*', ...channelInfo }, { quoted: message });
            return;
        }
        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦*', ...channelInfo }, { quoted: message });
            return;
        }
    } else {
        const senderId = message.key.participant || message.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        if (!message.key.fromMe && !senderIsSudo) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗢𝗪𝗡𝗘𝗥 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗜𝗡 𝗣𝗠*', ...channelInfo }, { quoted: message });
            return;
        }
    }
    let userToBan;
    
    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToBan = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToBan = message.message.extendedTextMessage.contextInfo.participant;
    }
    
    if (!userToBan) {
        await sock.sendMessage(chatId, { 
            text: '╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ ⚠️ *𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗢𝗥 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗔 𝗨𝗦𝗘𝗥*', 
            ...channelInfo 
        });
        return;
    }

    // Prevent banning the bot itself
    try {
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (userToBan === botId || userToBan === botId.replace('@s.whatsapp.net', '@lid')) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ 🤖 *𝗜 𝗖𝗔𝗡' + "'𝗧 𝗕𝗔𝗡 𝗠𝗬𝗦𝗘𝗟𝗙*", ...channelInfo }, { quoted: message });
            return;
        }
    } catch {}

    try {
        const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');
        const sessionId = getSessionId(sock);
        // Add user to banned list
        const bannedUsers = readSessionData(sessionId, 'banned.json', []);
        if (!bannedUsers.includes(userToBan)) {
            bannedUsers.push(userToBan);
            writeSessionData(sessionId, 'banned.json', bannedUsers);
            
            await sock.sendMessage(chatId, { 
                text: `╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ 🔨 *𝗕𝗔𝗡𝗡𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*\n│ 👤 @${userToBan.split('@')[0]}`,
                mentions: [userToBan],
                ...channelInfo 
            });
        } else {
            await sock.sendMessage(chatId, { 
                text: `╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ ⚠️ *𝗨𝗦𝗘𝗥 𝗜𝗦 𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗕𝗔𝗡𝗡𝗘𝗗*\n│ 👤 @${userToBan.split('@')[0]}`,
                mentions: [userToBan],
                ...channelInfo 
            });
        }
    } catch (error) {
        console.error('Error in ban command:', error);
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗕𝗔𝗡 𝗨𝗦𝗘𝗥*', ...channelInfo });
    }
}

module.exports = banCommand;
