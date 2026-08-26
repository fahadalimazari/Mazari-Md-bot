const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn } = require('../lib/index');
const { delay } = require('@whiskeysockets/baileys');

async function handleWelcome(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗦𝗘𝗧𝗨𝗣* ⎔ 〕\n│ ✅ *.welcome on* — Enable\n│ 🛠️ *.welcome set [msg]* — Set custom\n│ 🚫 *.welcome off* — Disable\n│\n│ *Variables:*\n│ • {user} - Mentions member\n│ • {group} - Group name\n│ • {description} - Group desc`,
            quoted: message
        });
    }

    const [command, ...args] = match.split(' ');
    const lowerCommand = command.toLowerCase();
    const customMessage = args.join(' ');

    if (lowerCommand === 'on') {
        if (await isWelcomeOn(chatId)) {
            return sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ ⚠️ *𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗘𝗡𝗔𝗕𝗟𝗘𝗗*', quoted: message });
        }
        await addWelcome(chatId, true, '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ 🎉 *Welcome @{user}! Glad to have you here.*');
        return sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ ✅ *𝗘𝗡𝗔𝗕𝗟𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*', quoted: message });
    }

    if (lowerCommand === 'off') {
        if (!(await isWelcomeOn(chatId))) {
            return sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ ⚠️ *𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗗𝗜𝗦𝗔𝗕𝗟𝗘𝗗*', quoted: message });
        }
        await delWelcome(chatId);
        return sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ 🚫 *𝗗𝗜𝗦𝗔𝗕𝗟𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬*', quoted: message });
    }

    if (lowerCommand === 'set') {
        if (!customMessage) {
            return sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ ⚠️ *𝗣𝗥𝗢𝗩𝗜𝗗𝗘 𝗔 𝗠𝗘𝗦𝗦𝗔𝗚𝗘*', quoted: message });
        }
        await addWelcome(chatId, true, customMessage);
        return sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ ✅ *𝗖𝗨𝗦𝗧𝗢𝗠 𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗦𝗘𝗧*', quoted: message });
    }

    // If no valid command is provided
    return sock.sendMessage(chatId, {
        text: `╭─〔 ⎔ *𝗪𝗘𝗟𝗖𝗢𝗠𝗘* ⎔ 〕\n│ ❌ *𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗖𝗢𝗠𝗠𝗔𝗡𝗗*`,
        quoted: message
    });
}

async function handleGoodbye(sock, chatId, message, match) {
    const lower = match?.toLowerCase();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `📤 *Goodbye Message Setup*\n\n✅ *.goodbye on* — Enable goodbye messages\n🛠️ *.goodbye set Your custom message* — Set a custom goodbye message\n🚫 *.goodbye off* — Disable goodbye messages\n\n*Available Variables:*\n• {user} - Mentions the leaving member\n• {group} - Shows group name`,
            quoted: message
        });
    }

    if (lower === 'on') {
        if (await isGoodByeOn(chatId)) {
            return sock.sendMessage(chatId, { text: '⚠️ Goodbye messages are *already enabled*.', quoted: message });
        }
        await addGoodbye(chatId, true, 'Goodbye {user} 👋');
        return sock.sendMessage(chatId, { text: '✅ Goodbye messages *enabled* with simple message. Use *.goodbye set [your message]* to customize.', quoted: message });
    }

    if (lower === 'off') {
        if (!(await isGoodByeOn(chatId))) {
            return sock.sendMessage(chatId, { text: '⚠️ Goodbye messages are *already disabled*.', quoted: message });
        }
        await delGoodBye(chatId);
        return sock.sendMessage(chatId, { text: '✅ Goodbye messages *disabled* for this group.', quoted: message });
    }

    if (lower.startsWith('set ')) {
        const customMessage = match.substring(4);
        if (!customMessage) {
            return sock.sendMessage(chatId, { text: '⚠️ Please provide a custom goodbye message. Example: *.goodbye set Goodbye!*', quoted: message });
        }
        await addGoodbye(chatId, true, customMessage);
        return sock.sendMessage(chatId, { text: '✅ Custom goodbye message *set successfully*.', quoted: message });
    }

    // If no valid command is provided
    return sock.sendMessage(chatId, {
        text: `❌ Invalid command. Use:\n*.goodbye on* - Enable\n*.goodbye set [message]* - Set custom message\n*.goodbye off* - Disable`,
        quoted: message
    });
}

module.exports = { handleWelcome, handleGoodbye };
// This code handles welcome and goodbye messages in a WhatsApp group using the Baileys library.