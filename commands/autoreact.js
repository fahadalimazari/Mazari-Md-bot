/**
 * Knight Bot - WhatsApp Bot
 * Auto React System (Fully Fixed)
 */

const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');

const defaultData = {
    autoreact: false,
    reactEmojis: [
        "🪀", "🥏", "🤩", "💔", "🕐️", "🤍", "🥵"
    ]
};

// Command to toggle autoreact (.autoreact on / .autoreact off)
async function autoreactCommand(sock, chatId, message, args = []) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        const sessionId = getSessionId(sock);

        if (!message.key.fromMe && !isOwner) {
            return sock.sendMessage(chatId, {
                text: '❌ This command is only for the owner!'
            });
        }

        const config = readSessionData(sessionId, 'react.json', defaultData);

        if (args.length > 0) {
            const action = args[0].toLowerCase();

            if (action === 'on' || action === 'enable') {
                config.autoreact = true;
            } else if (action === 'off' || action === 'disable') {
                config.autoreact = false;
            } else {
                return sock.sendMessage(chatId, {
                    text: '❌ Use: .autoreact on/off'
                });
            }
        } else {
            config.autoreact = !config.autoreact;
        }

        if (!config.reactEmojis) {
            config.reactEmojis = defaultData.reactEmojis;
        }

        writeSessionData(sessionId, 'react.json', config);

        const statusText = config.autoreact ? '𝗢𝗡' : '𝗢𝗙𝗙';
        const uiText = `╭─〔 ⎔ *𝗔𝗨𝗧𝗢 𝗥𝗘𝗔𝗖𝗧* ⎔ 〕─╮\n│ *𝗦𝗧𝗔𝗧𝗨𝗦* : *${statusText}* ✓\n╰────────────────────╯`;
        await sock.sendMessage(chatId, { text: uiText });

    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, { text: '❌ Error occurred!' });
    }
}

// Check status
function isAutoreactEnabled(sock) {
    try {
        const sessionId = getSessionId(sock);
        const config = readSessionData(sessionId, 'react.json', defaultData);
        return config.autoreact;
    } catch {
        return false;
    }
}

// React function
async function addAutoReaction(sock, message) {
    try {
        if (!isAutoreactEnabled(sock)) return;
        if (!message?.key?.id) return;
        if (message.key.fromMe) return;

        const remoteJid = message.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') return;

        const sessionId = getSessionId(sock);
        const config = readSessionData(sessionId, 'react.json', defaultData);
        const emojis = Array.isArray(config.reactEmojis) && config.reactEmojis.length > 0
            ? config.reactEmojis
            : defaultData.reactEmojis;

        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        await sock.sendMessage(remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });

    } catch (err) {
        console.error("AutoReact Error:", err);
    }
}

module.exports = {
    autoreactCommand,
    isAutoreactEnabled,
    addAutoReaction
};