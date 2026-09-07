/**
 * MAZARI MD - A WhatsApp Bot
 * Always Online Command
 */

const isOwnerOrSudo = require('../lib/isOwner');
const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');

if (!global.alwaysOnlineTimers) {
    global.alwaysOnlineTimers = new Map();
}

function initConfig(sessionId) {
    return readSessionData(sessionId, 'alwaysonline.json', { enabled: false });
}

async function alwaysOnlineCommand(sock, chatId, message, args = []) {
    try {
        const sessionId = getSessionId(sock);
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' });
            return;
        }

        const action = args.length > 0 ? args[0].toLowerCase() : '';
        
        if (action === 'on') {
            const config = initConfig(sessionId);
            
            if (config.enabled && global.alwaysOnlineTimers.has(sessionId)) {
                await sock.sendMessage(chatId, {
                    text: `─〔 ⎔ 𝗔𝗟𝗪𝗔𝗬𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 ⎔ 〕─╮\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗢𝗡 ✓\n╰────────────────────────────╯`
                });
                return;
            }

            config.enabled = true;
            writeSessionData(sessionId, 'alwaysonline.json', config);
            
            // Clear existing if any
            if (global.alwaysOnlineTimers.has(sessionId)) {
                clearInterval(global.alwaysOnlineTimers.get(sessionId));
            }

            // Start heartbeat
            const timer = setInterval(() => {
                try {
                    sock.sendPresenceUpdate('available');
                } catch (e) {
                    console.error('Error sending presence update:', e);
                }
            }, 30000); // 30 seconds

            global.alwaysOnlineTimers.set(sessionId, timer);
            sock.sendPresenceUpdate('available'); // Send immediately

            await sock.sendMessage(chatId, {
                text: `─〔 ⎔ 𝗔𝗟𝗪𝗔𝗬𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 ⎔ 〕─╮\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗢𝗡 ✓\n╰────────────────────────────╯`
            });

        } else if (action === 'off') {
            const config = initConfig(sessionId);
            
            if (!config.enabled && !global.alwaysOnlineTimers.has(sessionId)) {
                await sock.sendMessage(chatId, {
                    text: `─〔 ⎔ 𝗔𝗟𝗪𝗔𝗬𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 ⎔ 〕─╮\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗢𝗙𝗙 ✗\n╰────────────────────────────╯`
                });
                return;
            }

            config.enabled = false;
            writeSessionData(sessionId, 'alwaysonline.json', config);
            
            if (global.alwaysOnlineTimers.has(sessionId)) {
                clearInterval(global.alwaysOnlineTimers.get(sessionId));
                global.alwaysOnlineTimers.delete(sessionId);
            }

            await sock.sendMessage(chatId, {
                text: `─〔 ⎔ 𝗔𝗟𝗪𝗔𝗬𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 ⎔ 〕─╮\n│ 𝗦𝗧𝗔𝗧𝗨𝗦 : 𝗢𝗙𝗙 ✗\n╰────────────────────────────╯`
            });

        } else {
            await sock.sendMessage(chatId, {
                text: `─〔 ⎔ 𝗔𝗟𝗪𝗔𝗬𝗦 𝗢𝗡𝗟𝗜𝗡𝗘 ⎔ 〕─╮\n│ 𝗨𝗦𝗔𝗚𝗘 :\n│ .alwaysonline on\n│ .alwaysonline off\n╰────────────────────────────╯`
            });
        }
    } catch (error) {
        console.error('Error in alwaysonline command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' });
    }
}

// Function to start always online if it was enabled (used on reconnect)
function startAlwaysOnlineIfEnabled(sock) {
    try {
        const sessionId = getSessionId(sock);
        const config = initConfig(sessionId);
        
        if (config.enabled) {
            if (global.alwaysOnlineTimers.has(sessionId)) {
                clearInterval(global.alwaysOnlineTimers.get(sessionId));
            }
            
            const timer = setInterval(() => {
                try {
                    sock.sendPresenceUpdate('available');
                } catch (e) {
                    console.error('Error sending presence update:', e);
                }
            }, 30000);
            
            global.alwaysOnlineTimers.set(sessionId, timer);
            sock.sendPresenceUpdate('available');
        }
    } catch (error) {
        console.error('Error starting always online:', error);
    }
}

// Function to stop always online timer (used on disconnect/cleanup)
function stopAlwaysOnline(sessionId) {
    if (global.alwaysOnlineTimers && global.alwaysOnlineTimers.has(sessionId)) {
        clearInterval(global.alwaysOnlineTimers.get(sessionId));
        global.alwaysOnlineTimers.delete(sessionId);
    }
}

module.exports = {
    alwaysOnlineCommand,
    startAlwaysOnlineIfEnabled,
    stopAlwaysOnline
};
