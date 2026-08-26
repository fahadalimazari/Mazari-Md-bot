/**
 * Knight Bot - A WhatsApp Bot
 * Autoread Command - Automatically read all messages
 */

const isOwnerOrSudo = require('../lib/isOwner');
const { getSessionId, readSessionData, writeSessionData } = require('../lib/sessionManager');

// Initialize configuration file if it doesn't exist
function initConfig(sessionId) {
    return readSessionData(sessionId, 'autoread.json', { enabled: false });
}

// Toggle autoread feature
async function autoreadCommand(sock, chatId, message, args = []) {
    try {
        const sessionId = getSessionId(sock);
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!',
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '',
                        newsletterName: 'MAZARI MD',
                        serverMessageId: -1
                    }
                }
            });
            return;
        }

        
        // Initialize or read config
        const config = initConfig(sessionId);
        
        // Toggle based on argument or toggle current state if no argument
        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Invalid option! Use: .autoread on/off',
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '',
                            newsletterName: 'MAZARI MD',
                            serverMessageId: -1
                        }
                    }
                });
                return;
            }
        } else {
            // Toggle current state
            config.enabled = !config.enabled;
        }
        
        // Save updated configuration
        writeSessionData(sessionId, 'autoread.json', config);
        
        const statusText = config.enabled ? 'ON' : 'OFF';
        const uiText = `╭─〔 ⎔ *AUTO READ* ⎔ 〕─╮\n│ *STATUS* : *${statusText}* ✓\n╰─────────────────╯`;
        await sock.sendMessage(chatId, { text: uiText });
        
    } catch (error) {
        console.error('Error in autoread command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing command!',
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: 'MAZARI MD',
                    serverMessageId: -1
                }
            }
        });
    }
}

// Function to check if autoread is enabled
function isAutoreadEnabled(sessionId) {
    try {
        const config = initConfig(sessionId);
        return config.enabled;
    } catch (error) {
        console.error('Error checking autoread status:', error);
        return false;
    }
}

// Function to check if bot is mentioned in a message
function isBotMentionedInMessage(message, botNumber) {
    if (!message.message) return false;
    
    // Check for mentions in contextInfo (works for all message types)
    const messageTypes = [
        'extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
        'documentMessage', 'audioMessage', 'contactMessage', 'locationMessage'
    ];
    
    // Check for explicit mentions in mentionedJid array
    for (const type of messageTypes) {
        if (message.message[type]?.contextInfo?.mentionedJid) {
            const mentionedJid = message.message[type].contextInfo.mentionedJid;
            if (mentionedJid.some(jid => jid === botNumber)) {
                return true;
            }
        }
    }
    
    // Check for text mentions in various message types
    const textContent = 
        message.message.conversation || 
        message.message.extendedTextMessage?.text ||
        message.message.imageMessage?.caption ||
        message.message.videoMessage?.caption || '';
    
    if (textContent) {
        // Check for @mention format
        const botUsername = botNumber.split('@')[0];
        if (textContent.includes(`@${botUsername}`)) {
            return true;
        }
        
        // Check for bot name mentions (optional, can be customized)
        const botNames = [global.botname?.toLowerCase(), 'bot', 'knight', 'knight bot'];
        const words = textContent.toLowerCase().split(/\s+/);
        if (botNames.some(name => words.includes(name))) {
            return true;
        }
    }
    
    return false;
}

// Function to handle autoread functionality
async function handleAutoread(sock, message) {
    const sessionId = getSessionId(sock);
    if (isAutoreadEnabled(sessionId)) {
        // Get bot's ID
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Check if bot is mentioned
        const isBotMentioned = isBotMentionedInMessage(message, botNumber);
        
        // If bot is mentioned, read the message internally but don't mark as read in UI
        if (isBotMentioned) {
            
            // We don't call sock.readMessages() here, so the message stays unread in the UI
            return false; // Indicates message was not marked as read
        } else {
            // For regular messages, mark as read normally
            const key = { remoteJid: message.key.remoteJid, id: message.key.id, participant: message.key.participant };
            await sock.readMessages([key]);
            //console.log('✅ Marked message as read from ' + (message.key.participant || message.key.remoteJid).split('@')[0]);
            return true; // Indicates message was marked as read
        }
    }
    return false; // Autoread is disabled
}

module.exports = {
    autoreadCommand,
    isAutoreadEnabled,
    isBotMentionedInMessage,
    handleAutoread
};
