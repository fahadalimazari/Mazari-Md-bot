const { ttdl } = require("ruhend-scraper");
const axios = require("axios");

const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message, apiPreference = null) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link for the video." });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let videoUrl = null;
        let title = "TikTok Video";
        const captionText = "╭─〔 ⎔ *𝗧𝗜𝗞𝗧𝗢𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* ⎔ 〕\n│\n│ > *_Downloaded by MAZARI MD_*\n│\n╰───────────────────────";

        try {
            const downloadData = await ttdl(url);
            if (downloadData && (downloadData.video_hd || downloadData.video || downloadData.video_watermark)) {
                videoUrl = downloadData.video_hd || downloadData.video || downloadData.video_watermark;
                title = downloadData.title || title;
            } else if (downloadData && downloadData.data && downloadData.data.length > 0) {
                const mediaData = downloadData.data;
                for (let i = 0; i < Math.min(20, mediaData.length); i++) {
                    const media = mediaData[i];
                    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(media.url) || media.type === 'video';
                    
                    await sock.sendMessage(chatId, {
                        [isVideo ? 'video' : 'image']: { url: media.url },
                        caption: captionText,
                        ...(global.channelInfo || {})
                    }, { quoted: message });
                }
                return;
            }
        } catch (e) {
            console.log("ttdl scraper failed:", e.message);
        }

        if (!videoUrl) {
            try {
                const res = await axios.get('https://api.tiklydown.eu.org/v1/tiktok?url=' + encodeURIComponent(url));
                if (res.data && res.data.video) {
                    videoUrl = res.data.video.noWatermark || res.data.video.watermark;
                    title = res.data.title || title;
                }
            } catch (e) {
                console.log("tiklydown api failed:", e.message);
            }
        }

        if (!videoUrl) {
            return await sock.sendMessage(chatId, { text: "âŒ Failed to download TikTok video. The post might be private." }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                caption: captionText,
                ...(global.channelInfo || {})
            }, { quoted: message });
        } catch (e) {
            console.error("Failed to send tiktok video:", e.message);
        }

    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { text: "âŒ An error occurred." }, { quoted: message });
    }
}

async function handleTiktokChoice(sock, chatId, senderId, userMessage, message) {
    return false;
}

module.exports = { tiktokCommand, handleTiktokChoice };
