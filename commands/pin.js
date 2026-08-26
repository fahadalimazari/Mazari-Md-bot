const axios = require('axios');
const cheerio = require('cheerio');

async function pinCommand(sock, chatId, text, message) {
    if (!text) {
        return; // Silently ignore or can add a prompt
    }

    const url = text.trim();
    if (!url.includes('pinterest.com') && !url.includes('pin.it')) {
        return;
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const imageUrl = $('meta[property="og:image"]').attr('content');

        if (imageUrl) {
            await sock.sendMessage(chatId, {
                image: { url: imageUrl },
                caption: `📌 *Pinterest Image Downloader*`
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in pin command:', error.message);
    }
}

module.exports = pinCommand;
