const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');
const { getGroupMetadata } = require('../lib/myfunc');
const settings = require('../settings');

const GCS_STATUS_CHANNEL = {
    name: "MAZARI MD",
    link: "https://whatsapp.com/channel/0029Vb6GUj8BPzjOWNfnhm1B"
};
let cachedGcsChannelJid = null;

/**
 * .groupstatus / .gpstatus / .gstatus command
 * Posts a status update specifically for the group (shows up as a ring around the group profile logo).
 */
async function gcsstatusCommand(sock, chatId, senderId, message, args) {
    try {
        console.log(`[GROUP-STATUS] Command triggered by ${senderId} in ${chatId}`);

        if (!cachedGcsChannelJid) {
            try {
                const code = GCS_STATUS_CHANNEL.link.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];
                const metadata = await sock.newsletterMetadata("invite", code);
                if (metadata && metadata.id) {
                    cachedGcsChannelJid = metadata.id;
                    console.log(`[GROUP-STATUS] Resolved channel JID to ${cachedGcsChannelJid}`);
                }
            } catch (err) {
                console.error("[GROUP-STATUS] Failed to resolve channel JID:", err.message);
            }
        }
        const finalChannelJid = cachedGcsChannelJid || settings.newsletterJid;

        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        // 1. Permission checks
        if (!isOwner) {
            console.log('[GROUP-STATUS] Failed: Unauthorized user');
            return await sock.sendMessage(chatId, { text: '❌ Only the bot owner or sudo can use this command' }, { quoted: message });
        }

        // 2. Check for replied media or text
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const textArg = args.join(' ').trim();

        let content = null;

        if (quoted) {
            // Replied to a message - extract media or text
            const contentUnpacked = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
            
            let mediaType = '';
            let mediaKey = null;

            if (contentUnpacked.imageMessage) {
                mediaType = 'image';
                mediaKey = contentUnpacked.imageMessage;
            } else if (contentUnpacked.videoMessage) {
                mediaType = 'video';
                mediaKey = contentUnpacked.videoMessage;
            } else if (contentUnpacked.audioMessage) {
                mediaType = 'audio';
                mediaKey = contentUnpacked.audioMessage;
            }

            if (mediaKey) {
                await sock.sendMessage(chatId, { text: `⏳ Downloading and uploading media to group status...` }, { quoted: message });

                // Download media buffer
                const stream = await downloadContentFromMessage(mediaKey, mediaType);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                if (buffer.length === 0) {
                    throw new Error('Downloaded media buffer is empty');
                }

                // Generate WA Message Content (handles uploading to WA servers)
                const mediaGen = {};
                let statusSourceType = 4; // default to TEXT
                
                if (mediaType === 'image') {
                    mediaGen.image = buffer;
                    if (textArg) mediaGen.caption = textArg;
                    statusSourceType = 0; // IMAGE
                } else if (mediaType === 'video') {
                    mediaGen.video = buffer;
                    if (textArg) mediaGen.caption = textArg;
                    statusSourceType = 1; // VIDEO
                } else if (mediaType === 'audio') {
                    mediaGen.audio = buffer;
                    mediaGen.mimetype = mediaKey.mimetype || 'audio/mp4';
                    mediaGen.ptt = true;
                    statusSourceType = 3; // AUDIO
                }

                content = await generateWAMessageContent(mediaGen, { upload: sock.waUploadToServer });
                
                // Inject context info for group status metadata into inner media message
                const messageType = Object.keys(content)[0];
                if (messageType && content[messageType]) {
                    content[messageType].contextInfo = {
                        ...(content[messageType].contextInfo || {}),
                        isGroupStatus: true,
                        statusSourceType: statusSourceType,
                        statusAttributions: [
                            {
                                groupStatus: {
                                    authorJid: senderId
                                }
                            }
                        ],
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: finalChannelJid,
                            newsletterName: `${GCS_STATUS_CHANNEL.name} | ${message.pushName || 'Admin'}`,
                            serverMessageId: -1
                        }
                    };
                }
            } else {
                // Non-media message reply (text, document, buttons, templates, etc.)
                const quotedText = contentUnpacked.conversation ||
                                   contentUnpacked.extendedTextMessage?.text ||
                                   contentUnpacked.imageMessage?.caption ||
                                   contentUnpacked.videoMessage?.caption ||
                                   contentUnpacked.documentMessage?.caption ||
                                   contentUnpacked.documentMessage?.fileName ||
                                   contentUnpacked.documentMessage?.title ||
                                   contentUnpacked.caption ||
                                   contentUnpacked.text ||
                                   contentUnpacked.contentText ||
                                   contentUnpacked.selectedDisplayText ||
                                   contentUnpacked.title ||
                                   '';
                const statusText = textArg || quotedText;
                if (!statusText) {
                    console.log('[GROUP-STATUS] Failed: Quoted message has no text and no text argument was provided');
                    return await sock.sendMessage(chatId, { text: '❌ Please provide text or reply to a message with text/media to set a group status.' }, { quoted: message });
                }
                
                const quotedExtendedText = contentUnpacked.extendedTextMessage || {};

                // Text status configuration
                content = {
                    extendedTextMessage: {
                        text: statusText,
                        backgroundArgb: 4278241280, // Black color (Alpha: 255, R: 0, G: 0, B: 0)
                        font: 1,
                        matchedText: quotedExtendedText.matchedText,
                        canonicalUrl: quotedExtendedText.canonicalUrl,
                        description: quotedExtendedText.description,
                        title: quotedExtendedText.title,
                        jpegThumbnail: quotedExtendedText.jpegThumbnail,
                        previewType: quotedExtendedText.previewType,
                        contextInfo: {
                            isGroupStatus: true,
                            statusSourceType: 4, // TEXT
                            statusAttributions: [
                                {
                                    groupStatus: {
                                        authorJid: senderId
                                    }
                                }
                            ],
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: finalChannelJid,
                                newsletterName: `${GCS_STATUS_CHANNEL.name} | ${message.pushName || 'Admin'}`,
                                serverMessageId: -1
                            }
                        }
                    }
                };
            }
        } else {
            // No media quoted - send text status
            if (!textArg) {
                console.log('[GROUP-STATUS] Failed: No content provided');
                return await sock.sendMessage(chatId, { text: '❌ Please provide text or reply to media to set a group status.\nExample: `.gcsstatus Hello group!`' }, { quoted: message });
            }

            // Text status configuration
            content = {
                extendedTextMessage: {
                    text: textArg,
                    backgroundArgb: 4278241280, // Black color (Alpha: 255, R: 0, G: 0, B: 0)
                    font: 1,
                    contextInfo: {
                        isGroupStatus: true,
                        statusSourceType: 4, // TEXT
                        statusAttributions: [
                            {
                                groupStatus: {
                                    authorJid: senderId
                                }
                            }
                        ],
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: finalChannelJid,
                            newsletterName: `${GCS_STATUS_CHANNEL.name} | ${message.pushName || 'Admin'}`,
                            serverMessageId: -1
                        }
                    }
                }
            };
        }

        if (!content) {
            throw new Error('Failed to generate message content');
        }

        // 3. Determine targets
        let targetGroupJids = [];
        let groupMetadata = null;
        let progressMsg = null;

        console.log('[GROUP-STATUS] Fetching participating groups for global broadcast...');
        groupMetadata = await sock.groupFetchAllParticipating();
        targetGroupJids = Object.keys(groupMetadata);
        if (targetGroupJids.length === 0) {
            return await sock.sendMessage(chatId, { text: '❌ The bot is not in any groups.' }, { quoted: message });
        }
        const startUI = `𝘎𝘊𝘚 𝘚𝘛𝘈𝘛𝘜𝘚 — 𝘛𝘰𝘵𝘢𝘭: ${targetGroupJids.length} 𝘎𝘳𝘰𝘶𝘱𝘴`;
        progressMsg = await sock.sendMessage(chatId, { text: startUI }, { quoted: message });
        await new Promise(resolve => setTimeout(resolve, 1000));

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        const batchSize = 10;

        for (let i = 0; i < targetGroupJids.length; i += batchSize) {
            const batch = targetGroupJids.slice(i, i + batchSize);
            const startIdx = i + 1;
            const endIdx = Math.min(i + batchSize, targetGroupJids.length);

            if (progressMsg) {
                await sock.sendMessage(chatId, { 
                    text: `𝘎𝘊𝘚 𝘚𝘛𝘈𝘛𝘜𝘚 — 𝘗𝘳𝘰𝘤𝘦𝘴𝘴𝘪𝘯𝘨: ${startIdx}–${endIdx} 𝘰𝘧 ${targetGroupJids.length}`,
                    edit: progressMsg.key 
                });
            }

            for (const targetJid of batch) {
                try {
                    // Send the groupStatusMessage via relayMessage to bypass generateWAMessageContent validation
                    console.log(`[GROUP-STATUS] Relaying group status to: ${targetJid}`);
                    const messageToSend = generateWAMessageFromContent(
                        targetJid,
                        {
                            groupStatusMessage: {
                                message: content
                            },
                            groupStatusMessageV2: {
                                message: content
                            }
                        },
                        {
                            userJid: sock.user.id
                        }
                    );

                    await sock.relayMessage(targetJid, messageToSend.message, {
                        messageId: messageToSend.key.id
                    });
                    successCount++;

                    // Small delay per group
                    if (targetGroupJids.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                } catch (err) {
                    console.error(`[GROUP-STATUS] Failed to send status to ${targetJid}:`, err);
                    failCount++;
                }
            }

            if (i + batchSize < targetGroupJids.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between batches
            }
        }

        if (progressMsg) {
            const endUI = `𝘎𝘊𝘚 𝘚𝘛𝘈𝘛𝘜𝘚 — 𝘊𝘰𝘮𝘱𝘭𝘦𝘵𝘦 • 𝘚𝘶𝘤𝘤𝘦𝘴𝘴: ${successCount} • 𝘍𝘢𝘪𝘭𝘦𝘥: ${failCount}`;
            await sock.sendMessage(chatId, { text: endUI, edit: progressMsg.key });
        }

    } catch (error) {
        console.error('[GROUP-STATUS] Critical Error:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed to set group status.\nError: ${error.message}` }, { quoted: message });
    }
}

module.exports = gcsstatusCommand;
