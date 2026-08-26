const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function testReact() {
    const { state } = await useMultiFileAuthState('./session-923223602988');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('Connected!');
            
            const channelJid = '120363400318546224@newsletter';
            
            console.log('Fetching latest messages from channel...');
            try {
                // We don't have loadMessage, but we can try to react to 846 and 847 manually
                console.log('Reacting to 846 with ❤️...');
                await sock.newsletterReactMessage(channelJid, '846', '❤️');
                console.log('Successfully reacted to 846');
                
                console.log('Reacting to 847 with 🔥...');
                await sock.newsletterReactMessage(channelJid, '847', '🔥');
                console.log('Successfully reacted to 847');
                
                // Also let's try the fallback sendMessage
                console.log('Sending regular reaction to 847 as well...');
                await sock.sendMessage(channelJid, {
                    react: { text: '👍', key: { remoteJid: channelJid, fromMe: false, id: "A5B22CD31736745F23550CF81B02C79C" } }
                });
                console.log('Successfully sent regular reaction');
            } catch (err) {
                console.error('Error:', err);
            }
            
            setTimeout(() => process.exit(0), 3000);
        }
    });
}

testReact();
