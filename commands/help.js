const settings = require('../settings');
const os = require('os');
const fs = require('fs');
const { getPrefix } = require('../lib/index');
const { getSessionId, readSessionData } = require('../lib/sessionManager');

async function helpCommand(sock, chatId, message) {
    // Calculate Uptime
    const runtime = process.uptime();
    const hours = Math.floor(runtime / 3600);
    const minutes = Math.floor((runtime % 3600) / 60);
    const seconds = Math.floor(runtime % 60);
    const uptime = `${hours > 0 ? hours + 'h ' : ''}${minutes > 0 ? minutes + 'm ' : ''}${seconds}s`;

    // Get Bot Mode
    const sessionId = getSessionId(sock);
    const data = readSessionData(sessionId, 'messageCount.json', { isPublic: true });
    let mode = data.isPublic ? '𝚙𝚞𝚋𝚕𝚒𝚌' : '𝚙𝚛𝚒𝚟𝚊𝚝𝚎';
    if (data.isPrivateInbox) mode = '𝚙𝚛𝚒𝚟𝚊𝚝𝚎 𝚒𝚗𝚋𝚘𝚡';

    // Count commands dynamically from the commands folder
    const cmdCount = fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.js') && file !== 'handler.js')
        .length;

    // Construct the menu with the new design
    const helpMessage = `╔═〔 ⎔ *𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗* ⎔ 〕═╗

╭─〔 ⎔ *𝗕𝗢𝗧 𝗜𝗡𝗙𝗢* ⎔ 〕─╮
│
│ 〆 𝗢𝗪𝗡𝗘𝗥      › 𝗠𝗔𝗭𝗔𝗥𝗜 𝗛𝗔𝗖𝗞𝗘𝗥
│ 〆 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦   › ${cmdCount}
│ 〆 𝗥𝗨𝗡𝗧𝗜𝗠𝗘    › ${uptime}
│ 〆 𝗣𝗥𝗘𝗙𝗜𝗫     › [ ${getPrefix()} ]
│ 〆 𝗠𝗢𝗗𝗘       › ${mode}
│ 〆 𝗩𝗘𝗥𝗦𝗜𝗢𝗡    › 1.0.0
│
╰────────────────────╯

╭─〔 ⎔ *𝗔𝗜 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦* ⎔ 〕
│
│ ⟡ *ɢᴘᴛ*
│ ⟡ *ɢᴇᴍɪɴɪ*
│ ⟡ *ɪᴍᴀɢɪɴᴇ*
│ ⟡ *ꜰʟᴜx*
│ ⟡ *sᴏʀᴀ*
│
╰────────────────────

╭─〔 ⎔ *𝗢𝗪𝗡𝗘𝗥 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦* ⎔ 〕
│
│ ⟡ *ᴍᴏᴅᴇ*
│ ⟡ *sᴇᴛᴘʀᴇꜰɪx*
│ ⟡ *ᴜᴘᴛɪᴍᴇ*
│ ⟡ *ᴛɪᴍᴇ*
│ ⟡ *ᴄʜᴀɴɴᴇʟɪᴅ*
│ ⟡ *ᴄʟᴇᴀʀsᴇssɪᴏɴ*
│ ⟡ *ᴜᴘᴅᴀᴛᴇ*
│ ⟡ *ᴀᴜᴛᴏsᴛᴀᴛᴜs*
│ ⟡ *ᴀᴜᴛᴏʀᴇᴀᴄᴛ*
│ ⟡ *ᴀᴜᴛᴏᴛʏᴘɪɴɢ*
│ ⟡ *ᴀᴜᴛᴏʀᴇᴀᴅ*
│ ⟡ *ᴀɴᴛɪᴄᴀʟʟ*
│ ⟡ *ᴘᴍʙʟᴏᴄᴋᴇʀ*
│ ⟡ *sᴇᴛᴍᴇɴᴜᴅᴘ*
│ ⟡ *sᴇᴛᴍᴇɴᴜᴍᴜsɪᴄ*
│ ⟡ *sᴇᴛᴅᴘᴅ / sᴇᴛᴅᴘᴅᴇꜰᴀᴜʟᴛ*
│
╰────────────────────

╭─〔 ⎔ *𝗚𝗥𝗢𝗨𝗣 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦* ⎔ 〕
│
│ ⟡ *ɢᴄssᴛᴀᴛᴜs*
│ ⟡ *ᴋɪᴄᴋ*
│ ⟡ *ᴀᴅᴅ*
│ ⟡ *ʙᴀɴ*
│ ⟡ *ᴜɴʙᴀɴ*
│ ⟡ *ᴘʀᴏᴍᴏᴛᴇ*
│ ⟡ *ᴅᴇᴍᴏᴛᴇ*
│ ⟡ *ᴍᴜᴛᴇ*
│ ⟡ *ᴜɴᴍᴜᴛᴇ*
│ ⟡ *ᴛᴀɢᴀʟʟ*
│ ⟡ *ᴛᴀɢᴀᴅᴍɪɴ*
│ ⟡ *ʜɪᴅᴇᴛᴀɢ*
│ ⟡ *ᴀɴᴛɪʟɪɴᴋ*
│ ⟡ *ᴀɴᴛɪᴛᴀɢ*
│ ⟡ *ᴡᴇʟᴄᴏᴍᴇ*
│ ⟡ *ɢᴏᴏᴅʙʏᴇ*
│ ⟡ *ᴀᴅᴍɪɴʟᴏᴄᴋ*
│ ⟡ *ᴄᴜsᴛᴏᴍ sᴇᴛ*
│ ⟡ *ᴄᴜsᴛᴏᴍ ᴏꜰꜰ*
│ ⟡ *ᴄᴜsᴛᴏᴍ ʟɪsᴛ*
│ ⟡ *ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴏɴ*
│ ⟡ *ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴏꜰꜰ*
│ ⟡ *ᴀɴᴛɪsᴘᴀᴍ ᴏɴ*
│ ⟡ *ᴀɴᴛɪsᴘᴀᴍ ᴏꜰꜰ*
│ ⟡ *ᴘᴏʟʟ*
│
╰────────────────────

╭─〔 ⎔ *𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥𝗦* ⎔ 〕
│
│ ⟡ *ꜰᴀᴄᴇʙᴏᴏᴋ*
│ ⟡ *ɪɴsᴛᴀɢʀᴀᴍ*
│ ⟡ *ᴛɪᴋᴛᴏᴋ*
│ ⟡ *ᴛᴡɪᴛᴛᴇʀ*
│ ⟡ *ᴛʜʀᴇᴀᴅs*
│ ⟡ *ᴘʟᴀʏ*
│ ⟡ *sᴏɴɢ*
│ ⟡ *ᴠɪᴅᴇᴏ*
│ ⟡ *ʏᴛᴍᴘ4*
│ ⟡ *sᴘᴏᴛɪꜰʏ*
│ ⟡ *ᴘɪɴᴛᴇʀᴇsᴛ*
│ ⟡ *ʟʏʀɪᴄs*
│
╰────────────────────

╭─〔 ⎔ *𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥𝗦* ⎔ 〕
│
│ ⟡ *sᴛɪᴄᴋᴇʀ*
│ ⟡ *ǫᴄ*
│ ⟡ *sɪᴍᴀɢᴇ*
│ ⟡ *ʙʟᴜʀ*
│ ⟡ *ʀᴇᴍɪɴɪ*
│ ⟡ *ʀᴇᴍᴏᴠᴇʙɢ*
│ ⟡ *ᴄʀᴏᴘ*
│ ⟡ *ᴀᴛᴛᴘ*
│ ⟡ *ᴇᴍᴏᴊɪᴍɪx*
│ ⟡ *ᴛᴀᴋᴇ*
│
╰────────────────────

╭─〔 ⎔ *𝗙𝗨𝗡/𝗚𝗔𝗠𝗘𝗦* ⎔ 〕
│
│ ⟡ *ᴛɪᴄᴛᴀᴄᴛᴏᴇ*
│ ⟡ *ʜᴀɴɢᴍᴀɴ*
│ ⟡ *ᴛʀɪᴠɪᴀ*
│ ⟡ *ᴛʀᴜᴛʜ*
│ ⟡ *ᴅᴀʀᴇ*
│ ⟡ *ᴍᴇᴍᴇ*
│ ⟡ *ᴊᴏᴋᴇ*
│ ⟡ *ǫᴜᴏᴛᴇ*
│ ⟡ *ᴄᴏᴍᴘʟɪᴍᴇɴᴛ*
│ ⟡ *ɪɴsᴜʟᴛ*
│ ⟡ *sʜɪᴘ*
│ ⟡ *sɪᴍᴘ*
│ ⟡ *sᴛᴜᴘɪᴅ*
│
╰────────────────────

╭─〔 ⎔ *𝗔𝗡𝗜𝗠𝗘 𝗜𝗠𝗔𝗚𝗘𝗦* ⎔ 〕
│
│ ⟡ *ᴡᴀɪꜰᴜ*
│ ⟡ *ɴᴇᴋᴏ*
│ ⟡ *ᴍᴀɪᴅ*
│ ⟡ *ᴜɴɪꜰᴏʀᴍ*
│ ⟡ *ʜᴜsʙᴀɴᴅᴏ*
│ ⟡ *ᴋɪᴛsᴜɴᴇ*
│ ⟡ *sʜɪɴᴏʙᴜ*
│ ⟡ *ᴍᴇɢᴜᴍɪɴ*
│ ⟡ *ᴀɴɪᴍᴇǫᴜᴏᴛᴇ*
│
╰────────────────────

╭─〔 ⎔ *𝗨𝗧𝗜𝗟𝗜𝗧𝗜𝗘𝗦* ⎔ 〕
│
│ ⟡ *ʜᴇʟᴘ*
│ ⟡ *ᴘɪɴɢ*
│ ⟡ *ᴀʟɪᴠᴇ*
│ ⟡ *ᴏᴡɴᴇʀ*
│ ⟡ *ʀᴇᴘᴏ*
│ ⟡ *ɢʀᴏᴜᴘɪɴꜰᴏ*
│ ⟡ *sᴛᴀꜰꜰ*
│ ⟡ *ᴊɪᴅ*
│ ⟡ *ᴜʀʟ*
│ ⟡ *ssᴡᴇʙ*
│ ⟡ *ᴛᴏᴜʀʟ*
│ ⟡ *ᴅᴘ*
│
╰────────────────────

╭─〔 *𝗠𝗔𝗭𝗔𝗥𝗜 𝗛𝗔𝗖𝗞𝗘𝗥* 〕─╮
╰────────────────────────╯`;
    
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
                menuMsg = await sock.sendMessage(chatId, {
                    image: fs.readFileSync(customMenuPath),
                    caption: helpMessage,
                    contextInfo: global.promotionInfo?.contextInfo
                }, { quoted: message });
            } else {
                // If local image doesn't exist, skip the slow URL fetch and fallback to text immediately
                menuMsg = await sock.sendMessage(chatId, {
                    text: helpMessage,
                    contextInfo: global.promotionInfo?.contextInfo
                }, { quoted: message });
            }
        } catch (imageError) {
            console.error('Failed to send menu with URL image, falling back to text:', imageError);
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
