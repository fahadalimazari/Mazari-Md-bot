const gplay = require('google-play-scraper').default || require('google-play-scraper');

module.exports = async function (sock, chatId, message, query) {
    if (!query) {
        return await sock.sendMessage(chatId, { text: '⚠️ Please provide an app name to search on Play Store.\nExample: .playstore whatsapp' }, { quoted: message });
    }

    try {
        const results = await gplay.search({
            term: query,
            num: 1
        });

        if (!results || results.length === 0) {
            return await sock.sendMessage(chatId, { text: '❌ No results found on Play Store for: ' + query }, { quoted: message });
        }

        const appDetails = await gplay.app({ appId: results[0].appId });

        const appName = appDetails.title;
        const appId = appDetails.appId;
        const developer = appDetails.developer;
        const rating = appDetails.scoreText || "N/A";
        const installs = appDetails.installs || "N/A";
        const category = appDetails.genre || "N/A";
        const version = appDetails.version || "N/A";
        const icon = appDetails.icon;
        const url = appDetails.url;

        let caption = `*📱 PLAY STORE SEARCH 📱*\n\n`;
        caption += `*📌 App Name:* ${appName}\n`;
        caption += `*🆔 Package ID:* ${appId}\n`;
        caption += `*📂 Category:* ${category}\n`;
        caption += `*👨‍💻 Developer:* ${developer}\n`;
        caption += `*⭐ Rating:* ${rating}\n`;
        caption += `*📥 Installs:* ${installs}\n`;
        caption += `*🔖 Version:* ${version}\n\n`;
        caption += `*🔗 Link:* ${url}\n\n`;
        caption += `*© MAZARI MD*`;

        await sock.sendMessage(chatId, { image: { url: icon }, caption: caption }, { quoted: message });

    } catch (error) {
        console.error('Play Store Error:', error);
        await sock.sendMessage(chatId, { text: '❌ An error occurred while fetching data from Play Store.' }, { quoted: message });
    }
};
