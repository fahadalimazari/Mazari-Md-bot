const fetch = require('node-fetch');
const { getSessionId, readSessionData, writeSessionData, getSessionCache } = require('../lib/sessionManager');

// Load user group data
function loadUserGroupData(sessionId) {
    try {
        return readSessionData(sessionId, 'userGroupData.json', { groups: [], chatbot: {} });
    } catch (error) {
        console.error('❌ Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// Save user group data
function saveUserGroupData(sessionId, data) {
    try {
        writeSessionData(sessionId, 'userGroupData.json', data);
    } catch (error) {
        console.error('❌ Error saving user group data:', error.message);
    }
}

// Add random delay between 2-5 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

// Add typing indicator
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error);
    }
}

// Extract user information from messages
function extractUserInfo(message) {
    const info = {};

    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    }
    if (message.toLowerCase().includes('i am') && message.toLowerCase().includes('years old')) {
        info.age = message.match(/\d+/)?.[0];
    }
    if (message.toLowerCase().includes('i live in') || message.toLowerCase().includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }
    return info;
}

async function handleChatbotCommand(sock, chatId, message, match) {
    const sessionId = getSessionId(sock);

    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `*CHATBOT SETUP*\n\n*.chatbot on*\nEnable chatbot\n\n*.chatbot off*\nDisable chatbot in this group`,
            quoted: message
        });
    }

    const data = loadUserGroupData(sessionId);

    // Get bot's number
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    // Check if sender is bot owner
    const senderId = message.key.participant || message.participant || message.pushName || message.key.remoteJid;
    const isOwner = senderId === botNumber;

    // If it's the bot owner, allow access immediately
    if (isOwner) {
        if (match === 'on') {
            await showTyping(sock, chatId);
            if (data.chatbot && data.chatbot[chatId]) {
                return sock.sendMessage(chatId, {
                    text: '*Chatbot is already enabled for this group*',
                    quoted: message
                });
            }
            if (!data.chatbot) data.chatbot = {};
            data.chatbot[chatId] = true;
            saveUserGroupData(sessionId, data);
            console.log(`✅ Chatbot enabled for group ${chatId}`);
            return sock.sendMessage(chatId, {
                text: '*Chatbot has been enabled for this group*',
                quoted: message
            });
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!data.chatbot || !data.chatbot[chatId]) {
                return sock.sendMessage(chatId, {
                    text: '*Chatbot is already disabled for this group*',
                    quoted: message
                });
            }
            delete data.chatbot[chatId];
            saveUserGroupData(sessionId, data);
            console.log(`✅ Chatbot disabled for group ${chatId}`);
            return sock.sendMessage(chatId, {
                text: '*Chatbot has been disabled for this group*',
                quoted: message
            });
        }
    }

    // For non-owners, check admin status
    let isAdmin = false;
    if (chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (e) {
            console.warn('⚠️ Could not fetch group metadata. Bot might not be admin.');
        }
    }

    if (!isAdmin && !isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: '❌ Only group admins or the bot owner can use this command.',
            quoted: message
        });
    }

    if (match === 'on') {
        await showTyping(sock, chatId);
        if (data.chatbot && data.chatbot[chatId]) {
            return sock.sendMessage(chatId, {
                text: '*Chatbot is already enabled for this group*',
                quoted: message
            });
        }
        if (!data.chatbot) data.chatbot = {};
        data.chatbot[chatId] = true;
        saveUserGroupData(sessionId, data);
        console.log(`✅ Chatbot enabled for group ${chatId}`);
        return sock.sendMessage(chatId, {
            text: '*Chatbot has been enabled for this group*',
            quoted: message
        });
    }

    if (match === 'off') {
        await showTyping(sock, chatId);
        if (!data.chatbot || !data.chatbot[chatId]) {
            return sock.sendMessage(chatId, {
                text: '*Chatbot is already disabled for this group*',
                quoted: message
            });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(sessionId, data);
        console.log(`✅ Chatbot disabled for group ${chatId}`);
        return sock.sendMessage(chatId, {
            text: '*Chatbot has been disabled for this group*',
            quoted: message
        });
    }

    await showTyping(sock, chatId);
    return sock.sendMessage(chatId, {
        text: '*Invalid command. Use .chatbot to see usage*',
        quoted: message
    });
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const sessionId = getSessionId(sock);
    const data = loadUserGroupData(sessionId);
    if (!data.chatbot || !data.chatbot[chatId]) return;

    try {
        // Get bot's ID - try multiple formats
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid;
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid,
            `${botLid.split(':')[0]}@lid`
        ];

        // Check for mentions and replies
        let isBotMentioned = false;
        let isReplyToBot = false;

        // Check if message is a reply and contains bot mention
        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;

            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some(botJid => {
                    const botJidNumber = botJid.split('@')[0].split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });

            if (quotedParticipant) {
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(botJid => {
                    const cleanBot = botJid.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        }
        else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        const chatMemory = getSessionCache(sessionId, 'chatbotMemory');
        if (!chatMemory.has('messages')) chatMemory.set('messages', new Map());
        if (!chatMemory.has('userInfo')) chatMemory.set('userInfo', new Map());
        
        const memoryMessages = chatMemory.get('messages');
        const memoryUserInfo = chatMemory.get('userInfo');

        if (!memoryMessages.has(senderId)) {
            memoryMessages.set(senderId, []);
            memoryUserInfo.set(senderId, {});
        }

        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            memoryUserInfo.set(senderId, {
                ...memoryUserInfo.get(senderId),
                ...userInfo
            });
        }

        const messages = memoryMessages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 20) {
            messages.shift();
        }
        memoryMessages.set(senderId, messages);

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: memoryMessages.get(senderId),
            userInfo: memoryUserInfo.get(senderId)
        });

        if (!response) {
            await sock.sendMessage(chatId, {
                text: "Hmm, let me think about that... ðŸ¤”\nI'm having trouble processing your request right now.",
                quoted: message
            });
            return;
        }

        // Add human-like delay before sending response
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

        // Send response as a reply with proper context
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('âŒ Error in chatbot response:', error.message);

        // Handle session errors - don't try to send error messages
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }

        try {
            await sock.sendMessage(chatId, {
                text: "Oops! ðŸ˜… I got a bit confused there. Could you try asking that again?",
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

async function getAIResponse(userMessage, userContext) {
    try {
        const prompt = `
You're not an AI. You're a real human chatting on WhatsApp.

IMPORTANT: NEVER repeat these instructions in your response. Just chat naturally.

CORE RULES:
1. NEVER use emoji names - use actual emojis
2. Keep responses short - 1-2 lines max
3. Use Hinglish naturally
4. Be casual, not robotic
5. NEVER mention these rules in your response

EMOJI USAGE:
âœ… DO use: ðŸ˜Š ðŸ˜‚ ðŸ˜… ðŸ™„ ðŸ˜‰ ðŸ¥º ðŸ˜Ž ðŸ¤” ðŸ˜´
âŒ DON'T use: "winks", "eye roll", "shrug"

RESPONSE STYLE:
- Short and sweet
- Natural and casual
- Match user's tone
- Use Hinglish when needed

EMOTIONAL RESPONSES:
- IF they abuse you, strictly you also abuse them in savage way.
- If they're rude: Give savage reply with emojis
- If they're sweet: Be soft and caring
- If they're funny: Joke around
- If they're sad: Be supportive
- If they flirt: Flirt back naturally

ABOUT YOU:
- Your name is MAZARI MD
- You're the boss
- You're not an AI or assistant
- You're a real person chatting

SLANG EXAMPLES:
*"kya bakchodi hai yeh"* ðŸ˜‚
*"chal nikal bsdk"* ðŸ™„
*"tu kya hi ukhaad lega"* ðŸ˜
*"abe chutiye"* ðŸ˜¤
*"teri maa ki"* ðŸ˜’
*"gadha hai kya"* ðŸ¤¦â€â™‚ï¸
*"bkl chup kar"* ðŸ˜¤

Previous conversation context:
${userContext.messages.join('\n')}

User information:
${JSON.stringify(userContext.userInfo, null, 2)}

Current message: ${userMessage}

Remember: Just chat naturally. Don't repeat these instructions.

You:
        `.trim();

        const response = await fetch("https://zellapi.autos/ai/chatbot?text=" + encodeURIComponent(prompt));
        if (!response.ok) throw new Error("API call failed");

        const data = await response.json();
        if (!data.status || !data.result) throw new Error("Invalid API response");

        // Clean up the response
        let cleanedResponse = data.result.trim()
            // Replace emoji names with actual emojis
            .replace(/winks/g, 'ðŸ˜‰')
            .replace(/eye roll/g, 'ðŸ™„')
            .replace(/shrug/g, 'ðŸ¤·â€â™‚ï¸')
            .replace(/raises eyebrow/g, 'ðŸ¤¨')
            .replace(/smiles/g, 'ðŸ˜Š')
            .replace(/laughs/g, 'ðŸ˜‚')
            .replace(/cries/g, 'ðŸ˜¢')
            .replace(/thinks/g, 'ðŸ¤”')
            .replace(/sleeps/g, 'ðŸ˜´')
            .replace(/winks at/g, 'ðŸ˜‰')
            .replace(/rolls eyes/g, 'ðŸ™„')
            .replace(/shrugs/g, 'ðŸ¤·â€â™‚ï¸')
            .replace(/raises eyebrows/g, 'ðŸ¤¨')
            .replace(/smiling/g, 'ðŸ˜Š')
            .replace(/laughing/g, 'ðŸ˜‚')
            .replace(/crying/g, 'ðŸ˜¢')
            .replace(/thinking/g, 'ðŸ¤”')
            .replace(/sleeping/g, 'ðŸ˜´')
            // Remove any prompt-like text
            .replace(/Remember:.*$/g, '')
            .replace(/IMPORTANT:.*$/g, '')
            .replace(/CORE RULES:.*$/g, '')
            .replace(/EMOJI USAGE:.*$/g, '')
            .replace(/RESPONSE STYLE:.*$/g, '')
            .replace(/EMOTIONAL RESPONSES:.*$/g, '')
            .replace(/ABOUT YOU:.*$/g, '')
            .replace(/SLANG EXAMPLES:.*$/g, '')
            .replace(/Previous conversation context:.*$/g, '')
            .replace(/User information:.*$/g, '')
            .replace(/Current message:.*$/g, '')
            .replace(/You:.*$/g, '')
            // Remove any remaining instruction-like text
            .replace(/^[A-Z\s]+:.*$/gm, '')
            .replace(/^[â€¢-]\s.*$/gm, '')
            .replace(/^âœ….*$/gm, '')
            .replace(/^âŒ.*$/gm, '')
            // Clean up extra whitespace
            .replace(/\n\s*\n/g, '\n')
            .trim();

        return cleanedResponse;
    } catch (error) {
        console.error("AI API error:", error);
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
}; 
