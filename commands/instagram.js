const { igdl } = require("ruhend-scraper");
const axios = require("axios");

const processedMessages = new Set();

async function instagramCommand(sock, chatId, message, apiPreference = null) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { text: "Please provide an Instagram link for the video." });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let mediaToDownload = [];
        const captionText = "╭─〔 ⎔ *𝗜𝗡𝗦𝗧𝗔𝗚𝗥𝗔𝗠 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* ⎔ 〕\n│\n│ > *_Downloaded by MAZARI MD_*\n│\n╰───────────────────────";

        try {
            const downloadData = await igdl(url);
            if (downloadData && downloadData.data && downloadData.data.length > 0) {
                mediaToDownload = downloadData.data.map(m => m.url);
            }
        } catch (e) {
            console.log("igdl scraper failed:", e.message);
        }

        if (mediaToDownload.length === 0) {
            try {
                const res = await axios.get('https://api.siputzx.my.id/api/d/ig?url=' + encodeURIComponent(url));
                if (res.data && res.data.data) {
                    let urls = res.data.data.urls || (Array.isArray(res.data.data) ? res.data.data : [res.data.data]);
                    mediaToDownload = urls.map(u => u.url || u);
                }
            } catch (e) {
                console.log("siputzx api failed:", e.message);
            }
        }

        if (mediaToDownload.length === 0) {
            return await sock.sendMessage(chatId, { text: "âŒ Failed to download Instagram media. The post might be private." }, { quoted: message });
        }

        for (let i = 0; i < mediaToDownload.length && i < 10; i++) {
            const mediaUrl = mediaToDownload[i];
            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || url.includes('/reel/') || url.includes('/tv/');
            
            try {
                await sock.sendMessage(chatId, {
                    [isVideo ? 'video' : 'image']: { url: mediaUrl },
                    caption: captionText,
                    ...(global.channelInfo || {})
                }, { quoted: message });
            } catch (e) {
                console.error("Failed to send media:", e.message);
            }
        }

    } catch (error) {
        console.error('Error in Instagram command:', error);
        await sock.sendMessage(chatId, { text: "âŒ An error occurred." }, { quoted: message });
    }
}

module.exports = instagramCommand;
