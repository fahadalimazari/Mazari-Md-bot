const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');

async function unbanCommand(sock, chatId, message) {
    // Restrict in groups to admins; in private to owner/sudo
    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*', ...channelInfo }, { quoted: message });
            return;
        }
        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗔𝗗𝗠𝗜𝗡𝗦 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦*', ...channelInfo }, { quoted: message });
            return;
        }
    } else {
        const senderId = message.key.participant || message.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        if (!message.key.fromMe && !senderIsSudo) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗢𝗪𝗡𝗘𝗥 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦 𝗜𝗡 𝗣𝗠*', ...channelInfo }, { quoted: message });
            return;
        }
    }
    let userToUnban;
    
    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToUnban = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToUnban = message.message.extendedTextMessage.contextInfo.participant;
    }
    
    if (!userToUnban) {
        await sock.sendMessage(chatId, { 
            text: '╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ⚠️ *𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗢𝗥 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗔 𝗨𝗦𝗘𝗥*', 
            ...channelInfo 
        }, { quoted: message });
        return;
    }

    try {
        const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');
        const sessionId = getSessionId(sock);
        const bannedUsers = readSessionData(sessionId, 'banned.json', []);
        const index = bannedUsers.indexOf(userToUnban);
        if (index > -1) {
            bannedUsers.splice(index, 1);
            writeSessionData(sessionId, 'banned.json', bannedUsers);
            
            await sock.sendMessage(chatId, { 
                text: `╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ✅ *𝗨𝗡𝗕𝗔𝗡𝗡𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*\n│ 👤 @${userToUnban.split('@')[0]}`,
                mentions: [userToUnban],
                ...channelInfo 
            });
        } else {
            await sock.sendMessage(chatId, { 
                text: `╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ⚠️ *𝗨𝗦𝗘𝗥 𝗜𝗦 𝗡𝗢𝗧 𝗕𝗔𝗡𝗡𝗘𝗗*\n│ 👤 @${userToUnban.split('@')[0]}`,
                mentions: [userToUnban],
                ...channelInfo 
            });
        }
    } catch (error) {
        console.error('Error in unban command:', error);
        await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗨𝗡𝗕𝗔𝗡* ⎔ 〕\n│ ❌ *𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗨𝗡𝗕𝗔𝗡 𝗨𝗦𝗘𝗥*', ...channelInfo }, { quoted: message });
    }
}

module.exports = unbanCommand; 