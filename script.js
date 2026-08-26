const fs = require('fs');
const { getPrefix } = require('./lib/index');

const smallCapsMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ',
    'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ',
    'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ', '/': '/', ' ': ' '
};

function toSmallCaps(str) {
    return str.split('').map(c => smallCapsMap[c.toLowerCase()] || c).join('');
}

const commandsList = {
    "𝗔𝗜 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦": ["gpt", "gemini", "imagine", "flux", "sora"],
    "𝗢𝗪𝗡𝗘𝗥 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦": ["mode", "setprefix", "uptime", "time", "channelid", "clearsession", "update", "autostatus", "autoreact", "autotyping", "autoread", "anticall", "pmblocker", "setmenudp", "setmenumusic", "setdpd / setdpdefault"],
    "𝗚𝗥𝗢𝗨𝗣 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦": ["gcsstatus", "kick", "add", "ban", "unban", "promote", "demote", "mute", "unmute", "tagall", "tagadmin", "hidetag", "antilink", "antitag", "welcome", "goodbye", "adminlock", "custom set", "custom off", "custom list", "autoblock on", "autoblock off", "antispam on", "antispam off", "poll"],
    "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥𝗦": ["facebook", "instagram", "tiktok", "twitter", "threads", "play", "song", "video", "ytmp4", "spotify", "pinterest", "lyrics"],
    "𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥𝗦": ["sticker", "qc", "simage", "blur", "remini", "removebg", "crop", "attp", "emojimix", "take"],
    "𝗙𝗨𝗡/𝗚𝗔𝗠𝗘𝗦": ["tictactoe", "hangman", "trivia", "truth", "dare", "meme", "joke", "quote", "compliment", "insult", "ship", "simp", "stupid"],
    "𝗔𝗡𝗜𝗠𝗘 𝗜𝗠𝗔𝗚𝗘𝗦": ["waifu", "neko", "maid", "uniform", "husbando", "kitsune", "shinobu", "megumin", "animequote"],
    "𝗨𝗧𝗜𝗟𝗜𝗧𝗜𝗘𝗦": ["help", "ping", "alive", "owner", "repo", "groupinfo", "staff", "jid", "url", "ssweb", "tourl", "dp"]
};

let menuStr = `╔═〔 ⎔ *𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗* ⎔ 〕═╗

╭─〔 ⎔ *𝗕𝗢𝗧 𝗜𝗡𝗙𝗢* ⎔ 〕─╮
│
│ 〆 𝗢𝗪𝗡𝗘𝗥      › 𝗠𝗔𝗭𝗔𝗥𝗜 𝗛𝗔𝗖𝗞𝗘𝗥
│ 〆 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦   › \${cmdCount}
│ 〆 𝗥𝗨𝗡𝗧𝗜𝗠𝗘    › \${uptime}
│ 〆 𝗣𝗥𝗘𝗙𝗜𝗫     › [ \${getPrefix()} ]
│ 〆 𝗠𝗢𝗗𝗘       › \${mode}
│ 〆 𝗩𝗘𝗥𝗦𝗜𝗢𝗡    › 1.0.0
│
╰────────────────────╯\n\n`;

for (const [category, cmds] of Object.entries(commandsList)) {
    menuStr += `╭─〔 ⎔ *${category}* ⎔ 〕\n│\n`;
    for (const cmd of cmds) {
        menuStr += `│ ⟡ *${toSmallCaps(cmd)}*\n`;
    }
    menuStr += `│\n╰────────────────────\n\n`;
}

menuStr += `╭─〔 *𝗠𝗔𝗭𝗔𝗥𝗜 𝗛𝗔𝗖𝗞𝗘𝗥* 〕─╮
╰────────────────────────╯`;

const helpJsContent = `const settings = require('../settings');
const os = require('os');
const fs = require('fs');
const { getPrefix } = require('../lib/index');

async function helpCommand(sock, chatId, message) {
    // Calculate Uptime
    const runtime = process.uptime();
    const hours = Math.floor(runtime / 3600);
    const minutes = Math.floor((runtime % 3600) / 60);
    const seconds = Math.floor(runtime % 60);
    const uptime = \`\${hours > 0 ? hours + 'h ' : ''}\${minutes > 0 ? minutes + 'm ' : ''}\${seconds}s\`;

    // Get Bot Mode
    let isPublic = true;
    try {
        if (fs.existsSync('./data/messageCount.json')) {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof data.isPublic === 'boolean') isPublic = data.isPublic;
        }
    } catch (e) {}
    const mode = isPublic ? '𝚙𝚞𝚋𝚕𝚒𝚌' : '𝚙𝚛𝚒𝚟𝚊𝚝𝚎';

    // Count commands dynamically from the commands folder
    const cmdCount = fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.js') && file !== 'handler.js')
        .length;

    // Construct the menu with the new design
    const helpMessage = \`${menuStr}\`;
    
    // Add promotion contexts
    const audioCandidates = [
        './assets/musics/MUSIC.mp3',
        './assets/audio.mp3',
        './assets/audio.mpeg'
    ];

    const musicPath = audioCandidates.find(p => fs.existsSync(p));

    try {
        let menuMsg;

        try {
            const customMenuPath = './assets/images/custom_menu.jpg';
            if (fs.existsSync(customMenuPath)) {
                await sock.sendMessage(chatId, {
                    image: fs.readFileSync(customMenuPath),
                    caption: helpMessage,
                    contextInfo: global.promotionInfo?.contextInfo
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: helpMessage,
                    contextInfo: global.promotionInfo?.contextInfo
                }, { quoted: message });
            }
        } catch (imageError) {
            console.error('Failed to send menu image:', imageError);
            menuMsg = await sock.sendMessage(chatId, {
                text: helpMessage,
                contextInfo: global.promotionInfo?.contextInfo
            }, { quoted: message });
        }

        if (musicPath) {
            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(musicPath),
                mimetype: 'audio/mpeg',
                fileName: 'menu_music.mp3',
                ptt: false
            }, { quoted: null });
        }
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    }
}

module.exports = helpCommand;
`;

fs.writeFileSync('commands/help.js', helpJsContent);
console.log('Done rewriting help.js!');
