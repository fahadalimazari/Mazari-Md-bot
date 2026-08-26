const isOwnerOrSudo = require('../lib/isOwner');
const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');

const defaultMessage = '🚫 Direct messages are blocked!\nYou cannot DM this bot. Please contact the owner in group chats only.';

function readState(sock) {
    const sessionId = getSessionId(sock);
    const data = readSessionData(sessionId, 'pmblocker.json', { enabled: false, message: defaultMessage });
    return {
        enabled: !!data.enabled,
        message: typeof data.message === 'string' && data.message.trim() ? data.message : defaultMessage
    };
}

function writeState(sock, enabled, message) {
    const sessionId = getSessionId(sock);
    const current = readState(sock);
    const payload = {
        enabled: !!enabled,
        message: typeof message === 'string' && message.trim() ? message : current.message
    };
    writeSessionData(sessionId, 'pmblocker.json', payload);
}

async function pmblockerCommand(sock, chatId, message, args) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!' }, { quoted: message });
        return;
    }
    
    const argStr = (args || '').trim();
    const [sub, ...rest] = argStr.split(' ');
    const state = readState(sock);

    if (!sub || !['on', 'off', 'status', 'setmsg'].includes(sub.toLowerCase())) {
        await sock.sendMessage(chatId, { text: '*PMBLOCKER (Owner only)*\n\n.pmblocker on - Enable PM auto-block\n.pmblocker off - Disable PM blocker\n.pmblocker status - Show current status\n.pmblocker setmsg <text> - Set warning message' }, { quoted: message });
        return;
    }

    if (sub.toLowerCase() === 'status') {
        await sock.sendMessage(chatId, { text: `PM Blocker is currently *${state.enabled ? 'ON' : 'OFF'}*\nMessage: ${state.message}` }, { quoted: message });
        return;
    }

    if (sub.toLowerCase() === 'setmsg') {
        const newMsg = rest.join(' ').trim();
        if (!newMsg) {
            await sock.sendMessage(chatId, { text: 'Usage: .pmblocker setmsg <message>' }, { quoted: message });
            return;
        }
        writeState(sock, state.enabled, newMsg);
        await sock.sendMessage(chatId, { text: 'PM Blocker message updated.' }, { quoted: message });
        return;
    }

    const enable = sub.toLowerCase() === 'on';
    writeState(sock, enable);
    await sock.sendMessage(chatId, { text: `PM Blocker is now *${enable ? 'ENABLED' : 'DISABLED'}*.` }, { quoted: message });
}

module.exports = { pmblockerCommand, readState };
