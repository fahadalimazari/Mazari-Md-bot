const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');

async function gcnameCommand(sock, msg) {
    try {
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        
        if (!isGroup) {
            await sock.sendMessage(msg.key.remoteJid, { 
                text: '╭─〔 ⎔ 𝗚𝗥𝗢𝗨𝗣 𝗡𝗔𝗠𝗘 ⎔ 〕\n│ ⚠️ *This command can only be used in groups!*\n╰──────────────────────────────' 
            }, { quoted: msg });
            return;
        }

        const groupId = msg.key.remoteJid;
        
        // Check if sender is admin or owner/sudo
        const { isSenderAdmin } = await isAdmin(sock, groupId, sender);
        const isOwner = await isOwnerOrSudo(sender, sock, groupId);

        if (!isSenderAdmin && !isOwner) {
            await sock.sendMessage(groupId, { 
                text: '╭─〔 ⎔ 𝗚𝗥𝗢𝗨𝗣 𝗡𝗔𝗠𝗘 ⎔ 〕\n│ ⚠️ *Only group admins or bot owner can use this command!*\n╰──────────────────────────────' 
            }, { quoted: msg });
            return;
        }

        // Fetch group metadata
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(groupId);
        } catch (err) {
            console.error('Error fetching group metadata:', err);
            await sock.sendMessage(groupId, { 
                text: '╭─〔 ⎔ 𝗚𝗥𝗢𝗨𝗣 𝗡𝗔𝗠𝗘 ⎔ 〕\n│ ❌ *Failed to get group information!*\n╰──────────────────────────────' 
            }, { quoted: msg });
            return;
        }

        const groupName = groupMetadata.subject;

        await sock.sendMessage(groupId, { 
            text: `╭─〔 ⎔ 𝗚𝗥𝗢𝗨𝗣 𝗡𝗔𝗠𝗘 ⎔ 〕\n│ 📛 *Name:* ${groupName}\n╰──────────────────────────────` 
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in gcname command:', error);
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '╭─〔 ⎔ 𝗚𝗥𝗢𝗨𝗣 𝗡𝗔𝗠𝗘 ⎔ 〕\n│ ❌ *An unexpected error occurred!*\n╰──────────────────────────────' 
        }, { quoted: msg });
    }
}

module.exports = { gcnameCommand };
