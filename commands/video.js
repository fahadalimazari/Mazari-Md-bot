const yts = require('yt-search');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download? Provide a URL or search term.' }, { quoted: message });
            return;
        }

        let video;
        try {
            const search = await yts(query);
            if (!search || !search.videos.length) {
                return await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
            }
            video = search.videos[0];
        } catch (e) {
            return await sock.sendMessage(chatId, { text: 'Invalid YouTube link or video not found.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail || 'https://i.imgur.com/kSroM11.png' },
            caption: `*${video.title}*\n\n_Downloading video, please wait..._`
        }, { quoted: message });

        let videoUrl = null;
        let localFilePath = null;

        try {
            // Priority 1: Use local yt-dlp.exe (Most robust)
            const ytDlpPath = path.join(process.cwd(), 'yt-dlp.exe');
            if (fs.existsSync(ytDlpPath)) {
                try {
                    const tempDir = path.join(process.cwd(), 'temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    const fileName = `${Date.now()}.mp4`;
                    localFilePath = path.join(tempDir, fileName);

                    // Download as best video/audio combined mp4
                    await execPromise(`"${ytDlpPath}" -f "best[ext=mp4]" -o "${localFilePath}" "${video.url}"`);

                    if (fs.existsSync(localFilePath)) {
                        await sock.sendMessage(chatId, {
                            video: { url: localFilePath },
                            mimetype: 'video/mp4',
                            caption: `*${video.title}*\n\n> *_Downloaded by MAZARI MD_*`
                        }, { quoted: message });

                        // Clean up
                        return fs.unlinkSync(localFilePath);
                    }
                } catch (e) {
                    console.error('yt-dlp video failed:', e.message);
                    if (localFilePath && fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
                }
            }

            // Priority 2: Use APIs as fallback
            const encodedUrl = encodeURIComponent(video.url);

            // Try Custom youtube-dl API
            try {
                const params = new URLSearchParams();
                params.append('url', video.url);
                params.append('format', 'best'); // Use best to ensure video+audio
                
                const res = await axios.post('http://localhost:8080/youtube-dl/q', params, {
                    timeout: 30000
                });
                
                if (res.data && res.data.url) {
                    videoUrl = res.data.url;
                } else if (res.data && res.data.info && res.data.info.url) {
                    videoUrl = res.data.info.url;
                }
            } catch (e) {
                console.error('Custom youtube-dl API failed:', e.message);
            }

            // Try Akuari API
            if (!videoUrl) {
                try {
                    const res = await axios.get(`https://api.akuari.my.id/downloader/youtube?link=${encodedUrl}`);
                    if (res.data && res.data.status === true && res.data.dl_link && res.data.dl_link.mp4) {
                        videoUrl = res.data.dl_link.mp4;
                    }
                } catch (e) {
                    console.error('Akuari API fallback failed:', e.message);
                }
            }

            if (videoUrl) {
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: `*${video.title}*\n\n> *_Downloaded by MAZARI MD_*`
                }, { quoted: message });
                return;
            }

            throw new Error("Failed to get video from all available sources.");

        } catch (err) {
            console.error("Video download process failed:", err);
            await sock.sendMessage(chatId, { text: "âŒ Video download failed. YouTube is currently blocking the request. Please try again later." }, { quoted: message });
        }

    } catch (error) {
        console.error('[VIDEO] Command Internal Error:', error);
        await sock.sendMessage(chatId, { text: 'âŒ Failed to process the request due to an internal error.' }, { quoted: message });
    }
}

module.exports = videoCommand;
