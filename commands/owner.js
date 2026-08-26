const settings = require('../settings');

async function ownerCommand(sock, chatId) {
    const owner = '923223602988';
    
    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗛𝗔𝗖𝗞𝗘𝗥 〕
TEL;waid=${owner}:${owner}
END:VCARD`.trim();

    await sock.sendMessage(chatId, {
        contacts: { 
            displayName: "〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗛𝗔𝗖𝗞𝗘𝗥 〕", 
            contacts: [
                { vcard: vcard }
            ] 
        },
        contextInfo: global.promotionInfo?.contextInfo
    });
}

module.exports = ownerCommand;
