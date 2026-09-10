const yts = require('yt-search');
const axios = require('axios');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execFilePromise = util.promisify(execFile);

function findExecutable(name) {
    const isWin = process.platform === 'win32';
    const exeName = isWin ? `${name}.exe` : name;
    
    const candidates = [
        path.join(process.cwd(), exeName),
        path.join(__dirname, '..', exeName),
        path.join(__dirname, '..', 'bin', exeName)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
    }
    return exeName; // fallback to system PATH
}

async function playCommand(sock, chatId, message) {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const uniqueId = `play_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const outputTemplate = path.join(tempDir, `${uniqueId}.%(ext)s`);
    let downloadedFilePath = null;

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: 'Usage: .play <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        try {
            const search = await yts(query);
            if (!search || !search.videos.length) {
                return await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
            }
            video = search.videos[0];
        } catch (e) {
            return await sock.sendMessage(chatId, { text: 'Invalid YouTube link or video not found.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail || 'https://i.imgur.com/kSroM11.png' },
            caption: `🎵 Fetching: *${video.title}*\n⏱ Duration: ${video.timestamp}\n\n_Please wait, downloading and converting to high quality MP3..._`
        }, { quoted: message });

        const safeTitle = (video.title || 'song').replace(/[^\w\s-]/gi, '').trim().slice(0, 60) || 'song';

        // 1. PRIMARY: yt-dlp + ffmpeg
        try {
            const ytDlpExe = findExecutable('yt-dlp');
            const ffmpegExe = findExecutable('ffmpeg');

            const args = [
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--no-playlist',
                '--max-filesize', '50M',
                '-o', outputTemplate
            ];

            if (fs.existsSync(ffmpegExe)) {
                args.push('--ffmpeg-location', ffmpegExe);
            }

            args.push(video.url);

            await execFilePromise(ytDlpExe, args, { timeout: 120000 });

            const expectedMp3 = path.join(tempDir, `${uniqueId}.mp3`);
            if (fs.existsSync(expectedMp3) && fs.statSync(expectedMp3).size > 0) {
                downloadedFilePath = expectedMp3;
            }
        } catch (e) {
            console.error('[PLAY] yt-dlp primary download failed:', e.message);
        }

        // 2. SECONDARY FALLBACK: @distube/ytdl-core
        if (!downloadedFilePath) {
            try {
                const ytdl = require('@distube/ytdl-core');
                const fallbackPath = path.join(tempDir, `${uniqueId}.mp3`);
                const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                const writer = fs.createWriteStream(fallbackPath);

                await new Promise((resolve, reject) => {
                    stream.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    stream.on('error', reject);
                });

                if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).size > 0) {
                    downloadedFilePath = fallbackPath;
                }
            } catch (e) {
                console.error('[PLAY] @distube/ytdl-core fallback failed:', e.message);
            }
        }

        // 3. TERTIARY FALLBACK: Online API
        if (!downloadedFilePath) {
            try {
                const encodedUrl = encodeURIComponent(video.url);
                const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodedUrl}`, { timeout: 30000 });
                if (res.data?.data?.dl) {
                    const fallbackPath = path.join(tempDir, `${uniqueId}.mp3`);
                    const response = await axios({
                        url: res.data.data.dl,
                        method: 'GET',
                        responseType: 'stream',
                        timeout: 60000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    const writer = fs.createWriteStream(fallbackPath);
                    response.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).size > 0) {
                        downloadedFilePath = fallbackPath;
                    }
                }
            } catch (e) {
                console.error('[PLAY] Third-party API fallback failed:', e.message);
            }
        }

        // Send Audio File
        if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
            await sock.sendMessage(chatId, {
                audio: { url: downloadedFilePath },
                mimetype: 'audio/mpeg',
                fileName: `${safeTitle}.mp3`,
                ptt: false
            }, { quoted: message });
            return;
        }

        throw new Error('All download sources failed to produce a valid audio file.');

    } catch (err) {
        console.error('[PLAY ERROR] Download process failed:', err.message);
        await sock.sendMessage(chatId, { text: '❌ All download sources failed. Please try again later.' }, { quoted: message });
    } finally {
        // Safe Cleanup: delete downloaded file and any intermediate files
        try {
            if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
                fs.unlinkSync(downloadedFilePath);
            }
            // Check for any leftover temp files with uniqueId
            const files = fs.readdirSync(tempDir);
            for (const f of files) {
                if (f.startsWith(uniqueId)) {
                    try { fs.unlinkSync(path.join(tempDir, f)); } catch (e) { }
                }
            }
        } catch (cleanupErr) {
            console.error('[PLAY] Cleanup error:', cleanupErr.message);
        }
    }
}

module.exports = playCommand;