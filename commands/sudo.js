const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');

async function extractMentionedJid(sock, chatId, message, argsText) {
    let rawJid = null;
    // 1. Reply Method
    const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
    if (quoted) rawJid = quoted;

    // 2. Mention Method
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!rawJid && mentioned.length > 0) rawJid = mentioned[0];

    // 3. Number Method
    if (!rawJid && argsText) {
        let match = argsText.replace(/[^0-9]/g, '');
        if (match && match.length >= 7) {
            rawJid = match + '@s.whatsapp.net';
        }
    }
    
    if (!rawJid) return null;
    
    // Resolve @lid if in group
    if (rawJid.endsWith('@lid') && chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === rawJid || p.lid === rawJid);
            if (participant) {
                if (participant.phoneNumber) {
                    rawJid = participant.phoneNumber.includes('@') ? participant.phoneNumber : participant.phoneNumber + '@s.whatsapp.net';
                } else if (participant.id && participant.id.endsWith('@s.whatsapp.net')) {
                    rawJid = participant.id;
                }
            }
        } catch(e) {}
    }

    // Normalize JID (remove :device tags)
    if (rawJid.includes('@')) {
        const numOnly = rawJid.split('@')[0].split(':')[0];
        const domain = rawJid.split('@')[1];
        return numOnly + '@' + domain;
    }
    
    return rawJid;
}

async function sudoCommand(sock, chatId, message, userMessage = '') {
    const senderJid = message.key.participant || message.key.remoteJid;
    
    // STRICT OWNER CHECK: Only the main owner can use .setsudo and .delsudo
    const ownerNumbers = settings.ownerNumbers || [settings.ownerNumber];
    const senderNum = senderJid.split('@')[0].replace(/[^0-9]/g, '');
    
    let isMainOwner = message.key.fromMe;
    if (!isMainOwner) {
        isMainOwner = ownerNumbers.some(num => {
            const cleanNum = String(num).replace(/[^0-9]/g, '');
            return senderNum === cleanNum;
        });
    }

    const commandStr = userMessage.split(/\s+/)[0].toLowerCase();
    let argsText = userMessage.slice(commandStr.length).trim();
    
    let action = '';
    if (commandStr === '.setsudo') action = 'add';
    else if (commandStr === '.delsudo') action = 'del';
    else if (commandStr === '.sudo') {
        const sub = argsText.split(' ')[0].toLowerCase();
        if (sub === 'add') { action = 'add'; argsText = argsText.slice(3).trim(); }
        else if (sub === 'del' || sub === 'remove') { action = 'del'; argsText = argsText.slice(sub.length).trim(); }
        else if (sub === 'list') action = 'list';
    }

    if (!action) return;

    if (action === 'list') {
        const isOwner = await isOwnerOrSudo(senderJid, sock, chatId);
        if (!isOwner && !message.key.fromMe) return;

        const list = await getSudoList();
        if (list.length === 0) {
            await sock.sendMessage(chatId, { text: 'No sudo users set.' });
            return;
        }
        const text = list.map((j, i) => `${i + 1}. ${j.split('@')[0]}`).join('\n');
        await sock.sendMessage(chatId, { text: `Sudo users:\n${text}` });
        return;
    }

    if (!isMainOwner) {
        // Silently ignore if not owner
        return;
    }

    const targetJid = await extractMentionedJid(sock, chatId, message, argsText);
    if (!targetJid) {
        const title = action === 'add' ? '𝗦𝗘𝗧 𝗦𝗨𝗗𝗢' : '𝗗𝗘𝗟 𝗦𝗨𝗗𝗢';
        const errUi = `╭─〔 ⎔ *${title}* ⎔ 〕\n│ ⚠️ *𝗥𝗘𝗣𝗟𝗬, 𝗠𝗘𝗡𝗧𝗜𝗢𝗡 𝗢𝗥 𝗨𝗦𝗘 𝗔 𝗡𝗨𝗠𝗕𝗘𝗥*`;
        await sock.sendMessage(chatId, { text: errUi }, { quoted: message });
        return;
    }

    if (targetJid.endsWith('@lid')) {
        await sock.sendMessage(chatId, { text: '❌ Could not resolve actual phone number from this linked device ID. Please use the number method (e.g. .setsudo 923...)' }, { quoted: message });
        return;
    }

    const targetNum = targetJid.split('@')[0];

    if (action === 'add') {
        // Check if already sudo
        const currentList = await getSudoList();
        if (currentList.includes(targetJid)) {
            const dupUi = `╭─〔 ⎔ *𝗦𝗨𝗗𝗢* ⎔ 〕\n│ ⚠️ *𝗨𝗦𝗘𝗥 𝗜𝗦 𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗔𝗗𝗗𝗘𝗗*`;
            await sock.sendMessage(chatId, { text: dupUi }, { quoted: message });
            return;
        }

        const ok = await addSudo(targetJid);
        if (ok) {
            const updatedList = await getSudoList();
            const uniqueList = [...new Set(updatedList)];
            const emojis = ['😈', '👑', '⚡', '🔥', '💀', '🗿', '🦅', '🐉'];
            let listUi = '';
            
            uniqueList.forEach((jid, index) => {
                const num = jid.split('@')[0];
                const emoji = emojis[index % emojis.length];
                listUi += `│ ${emoji} *${num}*\n`;
            });
            
            const uiText = `╭─〔 ⎔ *𝗦𝗨𝗗𝗢 𝗨𝗦𝗘𝗥𝗦* ⎔ 〕\n│\n│ 🛡️ *𝗦𝗨𝗗𝗢 𝗟𝗜𝗦𝗧* :\n${listUi}│\n│ ✓ *𝗡𝗘𝗪 𝗦𝗨𝗗𝗢 𝗔𝗗𝗗𝗘𝗗*`;
            
            await sock.sendMessage(chatId, { 
                text: uiText
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: '❌ Failed to add sudo.' }, { quoted: message });
        }
        return;
    }

    if (action === 'del') {
        // Check if actually in sudo list
        const currentList = await getSudoList();
        if (!currentList.includes(targetJid)) {
            const notUi = `╭─〔 ⎔ *𝗦𝗨𝗗𝗢* ⎔ 〕\n│ ⚠️ *𝗨𝗦𝗘𝗥 𝗜𝗦 𝗡𝗢𝗧 𝗜𝗡 𝗧𝗛𝗘 𝗦𝗨𝗗𝗢 𝗟𝗜𝗦𝗧*`;
            await sock.sendMessage(chatId, { text: notUi }, { quoted: message });
            return;
        }

        // Don't let owner remove themselves
        const isTargetOwner = ownerNumbers.some(num => {
            const cleanNum = String(num).replace(/[^0-9]/g, '');
            return targetNum === cleanNum;
        });
        
        if (isTargetOwner || message.key.fromMe && targetJid === senderJid) {
            await sock.sendMessage(chatId, { text: '❌ The main owner cannot be removed.' }, { quoted: message });
            return;
        }
        const ok = await removeSudo(targetJid);
        if (ok) {
            const uiText = `╭─〔 ⎔ *𝗦𝗨𝗗𝗢 𝗥𝗘𝗠𝗢𝗩𝗘𝗗* ⎔ 〕\n│ 📱 *𝗡𝗨𝗠𝗕𝗘𝗥* : *${targetNum}*\n│ 🛡️ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗥𝗘𝗠𝗢𝗩𝗘𝗗*`;
            await sock.sendMessage(chatId, { 
                text: uiText
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: '❌ Failed to remove sudo.' }, { quoted: message });
        }
        return;
    }
}

module.exports = sudoCommand;


