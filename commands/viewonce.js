const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');
const { getSessionId, readSessionData, writeSessionData, getSessionCache } = require('../lib/sessionManager');

// Load persisted modes on startup
function loadVVMode(sessionId) {
    const cache = getSessionCache(sessionId, 'vvMode');
    if (!cache.has('loaded')) {
        const data = readSessionData(sessionId, 'vvMode.json', {});
        for (const [user, mode] of Object.entries(data)) {
            cache.set(user, mode);
        }
        cache.set('loaded', true);
    }
    return cache;
}

// Save modes to file
function saveVVMode(sessionId, cache) {
    const data = {};
    for (const [user, mode] of cache) {
        if (user !== 'loaded') data[user] = mode;
    }
    writeSessionData(sessionId, 'vvMode.json', data);
}

/**
 * REUSABLE: Extract view-once media and return buffer
 * Used by both .vv and ❤ secret command
 * Returns: { mediaContent, mediaType, mimeType, caption, buffer } or null if not view-once
 */
async function extractViewOnceMedia(message) {
    try {
        // 2. Reply Validation
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return null;
        }

        const vOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
        const quotedImage = vOnce.imageMessage;
        const quotedVideo = vOnce.videoMessage;
        const quotedAudio = vOnce.audioMessage;

        // 3. Prepare Media Extraction
        let mediaContent, mediaType, mimeType, caption;
        if (quotedImage && (quotedImage.viewOnce || vOnce === quoted.viewOnceMessage?.message || vOnce === quoted.viewOnceMessageV2?.message)) {
            mediaContent = quotedImage;
            mediaType = 'image';
            mimeType = 'image/jpeg';
            caption = quotedImage.caption || '';
        } else if (quotedVideo && (quotedVideo.viewOnce || vOnce === quoted.viewOnceMessage?.message || vOnce === quoted.viewOnceMessageV2?.message)) {
            mediaContent = quotedVideo;
            mediaType = 'video';
            mimeType = 'video/mp4';
            caption = quotedVideo.caption || '';
        } else if (quotedAudio && (quotedAudio.viewOnce || vOnce === quoted.viewOnceMessage?.message || vOnce === quoted.viewOnceMessageV2?.message)) {
            mediaContent = quotedAudio;
            mediaType = 'audio';
            mimeType = 'audio/mpeg';
            caption = '';
        } else {
            return null;
        }

        // 4. Download Content
        if (!mediaContent.mediaKey) {
            throw new Error('Media key is missing. The message may have expired or cannot be decrypted.');
        }
        
        const stream = await downloadContentFromMessage(mediaContent, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        return { mediaContent, mediaType, mimeType, caption, buffer };

    } catch (error) {
        console.error('❌ Extract view-once error:', error.message || error);
        return null;
    }
}

/**
 * .vv command - Per-User Mode System
 * .vv private / .vv public -> Change Mode for the user
 * .vv -> Extract and Send based on user's Mode
 */
async function viewonceCommand(sock, chatId, message) {
    try {
        const sessionId = getSessionId(sock);
        const vvMode = loadVVMode(sessionId);

        const userJid = message.key.participant || message.key.remoteJid;
        if (!userJid) {
            console.error('No userJid found for VV command');
            return await sock.sendMessage(chatId, { text: '❌ Unable to identify user.' }, { quoted: message });
        }

        const text = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            ''
        ).trim().toLowerCase();

        const args = text.split(/\s+/);
        const subCommand = args[1];

        console.log('VV Command - User:', userJid, 'SubCommand:', subCommand);

        // 1. Handle Mode Configuration (Per User)
        if (subCommand === 'private' || subCommand === 'public') {
            const newMode = subCommand;
            vvMode.set(userJid, newMode);
            saveVVMode(sessionId, vvMode); // Persist

            const responseText = newMode === 'private' ?
                '🔒 VV mode set to PRIVATE for you only' :
                '🌐 VV mode set to PUBLIC for you only';

            console.log('VV Mode set for', userJid, 'to', newMode);
            return await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        }

        // Use reusable extraction function
        const extracted = await extractViewOnceMedia(message);
        if (!extracted) {
            return await sock.sendMessage(chatId, { text: '❌ Reply to a view-once message' }, { quoted: message });
        }

        const { mediaType, mimeType, caption, buffer } = extracted;

        // 5. Get User's Mode
        const mode = vvMode.get(userJid) || 'public';
        console.log('VV Extract - User:', userJid, 'Mode:', mode, 'Sending to:', mode === 'private' ? userJid : chatId);

        const vvCaption = `╭─〔 ⎔ *𝗩𝗜𝗘𝗪 𝗢𝗡𝗖𝗘* ⎔ 〕\n│ 🔓 *𝗩𝗜𝗘𝗪 𝗢𝗡𝗖𝗘 𝗠𝗘𝗗𝗜𝗔*`;

        // 6. Send Based on Mode
        if (mode === 'private') {
            // Send to user's private chat
            try {
                if (mediaType === 'image') {
                    await sock.sendMessage(userJid, { image: buffer, caption: vvCaption });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(userJid, { video: buffer, caption: vvCaption });
                } else if (mediaType === 'audio') {
                    await sock.sendMessage(userJid, { audio: buffer, mimetype: mimeType, ptt: false });
                }

                // Confirmation in original chat
                await sock.sendMessage(chatId, { text: '✅ Sent privately to you' });
                return;

            } catch (e) {
                console.error('❌ Private send failed for', userJid, ':', e);
                return await sock.sendMessage(chatId, { text: '❌ Failed to send media privately' });
            }
        }

        // 7. Public Mode - Send in same chat
        const options = { quoted: message };
        if (mediaType === 'image') {
            await sock.sendMessage(chatId, { image: buffer, caption: vvCaption }, options);
        } else if (mediaType === 'video') {
            await sock.sendMessage(chatId, { video: buffer, caption: vvCaption }, options);
        } else if (mediaType === 'audio') {
            await sock.sendMessage(chatId, { audio: buffer, mimetype: mimeType, ptt: false }, options);
        }

    } catch (error) {
        console.error('❌ Fatal error in VV:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to process command!' });
    }
}

module.exports = viewonceCommand;
module.exports.extractViewOnceMedia = extractViewOnceMedia;