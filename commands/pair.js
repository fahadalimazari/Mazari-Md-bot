const { initSession, pairingCodesStore } = require('../lib/baileys-helper');

async function pairCommand(sock, chatId, message, args) {
    try {
        if (!args || args.trim() === '') {
            return await sock.sendMessage(chatId, {
                text: 'Please provide a valid WhatsApp number\nExample: .pair 91702395XXXX',
                contextInfo: { forwardingScore: 1, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterName: 'MAZARI BOT', newsletterJid: '', serverMessageId: -1 } }
            });
        }
        
        const numbers = args.split(',').map(n => n.replace(/[^0-9]/g, '')).filter(n => n.length > 7 && n.length < 16);
        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, { text: `╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\n│ ❌ Invalid number format.\n╰──────────────` });
        }
        
        for (const number of numbers) {
            const jid = number + '@s.whatsapp.net';
            const result = await sock.onWhatsApp(jid);
            if (!result || !result[0] || !result[0].exists) {
                return await sock.sendMessage(chatId, { text: `╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\n│ ❌ That number is not registered on WhatsApp.\n╰──────────────` });
            }
            
            await sock.sendMessage(chatId, { text: `╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\n│ Pairing number: ${number}\n│ Please wait for code...\n╰──────────────` });
            
            // Delete old code from store if any
            pairingCodesStore.delete(number);
            
            // Generate locally (force true wipes old corrupted auth folders)
            await initSession(number, { usePairingCode: true, force: true });
            
            let attempts = 0;
            const interval = setInterval(async () => {
                const code = pairingCodesStore.get(number);
                if (code) {
                    clearInterval(interval);
                    await sock.sendMessage(chatId, {
                        text: `╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\n│ Pairing Code: *${code}*\n│ Number: ${number}\n│\n│ WhatsApp → Settings\n│ Linked Devices → Link with Phone Number\n╰──────────────`,
                        contextInfo: { forwardingScore: 1, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterName: 'MAZARI BOT', newsletterJid: '', serverMessageId: -1 } }
                    });
                } else if (attempts > 20) { // wait up to 20 seconds
                    clearInterval(interval);
                    await sock.sendMessage(chatId, { text: 'Failed to generate pairing code locally. Please try again later.' });
                }
                attempts++;
            }, 1000);
        }
    } catch (err) {
        console.error(err);
        await sock.sendMessage(chatId, { text: 'An error occurred. Please try again later.' });
    }
}

module.exports = pairCommand;