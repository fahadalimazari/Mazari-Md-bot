const { setAntilink, getAntilink, removeAntilink, addAllowedDomain, removeAllowedDomain } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, message) {
    try {
        // 1. Fetch fresh metadata and battle-tested admin check
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, true);

        // 2. Permission Logic
        if (!isSenderAdmin) {
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗢𝗡𝗟𝗬* ⎔ 〕\n│ ⚠️ *𝗧𝗛𝗜𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗜𝗦 𝗙𝗢𝗥 𝗚𝗥𝗢𝗨𝗣 𝗔𝗗𝗠𝗜𝗡𝗦*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            return;
        }

        if (!isBotAdmin) {
            const ui = `╭─〔 ⎔ *𝗕𝗢𝗧 𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗗* ⎔ 〕\n│ ⚠️ *𝗣𝗟𝗘𝗔𝗦𝗘 𝗠𝗔𝗞𝗘 𝗧𝗛𝗘 𝗕𝗢𝗧 𝗔𝗡 𝗔𝗗𝗠𝗜𝗡 𝗙𝗜𝗥𝗦𝗧*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            return;
        }

        const args = userMessage.slice(9).toLowerCase().trim().split(' ').filter(Boolean);
        const action = args[0];

        if (!action) {
            const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞 𝗠𝗢𝗗𝗘* ⎔ 〕\n│\n│ 🔴 *𝗞𝗜𝗖𝗞*  → 𝗟𝗜𝗡𝗞 + 𝗞𝗜𝗖𝗞\n│ 🟡 *𝗪𝗔𝗥𝗡*  → 𝟯 𝗪𝗔𝗥𝗡𝗦 + 𝗞𝗜𝗖𝗞\n│ 🟢 *𝗗𝗘𝗟𝗘𝗧𝗘* → 𝗟𝗜𝗡𝗞 𝗢𝗡𝗟𝗬\n│ ⚪ *𝗢𝗙𝗙* → 𝗗𝗜𝗦𝗔𝗕𝗟𝗘\n│\n│ ⟡ *𝗨𝗦𝗘:* \`.antilink kick\`\n│ ⟡ *𝗨𝗦𝗘:* \`.antilink warn\`\n│ ⟡ *𝗨𝗦𝗘:* \`.antilink delete\`\n│ ⟡ *𝗨𝗦𝗘:* \`.antilink off\``;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
            return;
        }

        switch (action) {
            case 'kick':
            case 'warn':
            case 'delete': {
                await setAntilink(chatId, 'on', action);
                const actionLabel = action.toUpperCase();
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *${actionLabel}*\n│ ⚠️ *𝗟𝗜𝗠𝗜𝗧* : *𝟯 𝗪𝗔𝗥𝗡𝗜𝗡𝗚𝗦*`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞* ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗚𝗥𝗢𝗨𝗣 𝗟𝗜𝗡𝗞𝗦 𝗔𝗥𝗘 𝗡𝗢𝗪 𝗔𝗟𝗟𝗢𝗪𝗘𝗗*`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'status': {
                const status = await getAntilink(chatId, 'on');
                if (!status || !status.enabled) {
                    const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞* ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗚𝗥𝗢𝗨𝗣 𝗟𝗜𝗡𝗞𝗦 𝗔𝗥𝗘 𝗡𝗢𝗪 𝗔𝗟𝗟𝗢𝗪𝗘𝗗*`;
                    await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                } else {
                    const actionLabel = (status.action || 'delete').toUpperCase();
                    const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞 𝗦𝗧𝗔𝗧𝗨𝗦* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ⚙️ *𝗠𝗢𝗗𝗘* : *${actionLabel}*\n│ ⚠️ *𝗟𝗜𝗠𝗜𝗧* : *𝟯 𝗪𝗔𝗥𝗡𝗜𝗡𝗚𝗦*`;
                    await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                }
                break;
            }

            case 'allow': {
                const domain = args[1];
                if (!domain) {
                    await sock.sendMessage(chatId, { text: '❌ Please provide a domain to allow (e.g. .antilink allow youtube.com)' }, { quoted: message });
                    return;
                }
                await addAllowedDomain(chatId, domain);
                const ui = `╭─〔 ⎔ *𝗟𝗜𝗡𝗞 𝗔𝗟𝗟𝗢𝗪𝗘𝗗* ⎔ 〕\n│ 🔗 *𝗗𝗢𝗠𝗔𝗜𝗡* : *${domain}*\n│ ✓ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗟𝗟𝗢𝗪𝗘𝗗*`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            case 'disallow': {
                const domain = args[1];
                if (!domain) {
                    await sock.sendMessage(chatId, { text: '❌ Please provide a domain to disallow (e.g. .antilink disallow youtube.com)' }, { quoted: message });
                    return;
                }
                await removeAllowedDomain(chatId, domain);
                const ui = `╭─〔 ⎔ *𝗟𝗜𝗡𝗞 𝗥𝗘𝗠𝗢𝗩𝗘𝗗* ⎔ 〕\n│ 🔗 *𝗗𝗢𝗠𝗔𝗜𝗡* : *${domain}*\n│ ✓ *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗥𝗘𝗠𝗢𝗩𝗘𝗗*`;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }

            default: {
                const ui = `╭─〔 ⎔ *𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞* ⎔ 〕\n│ ❌ *𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗢𝗣𝗧𝗜𝗢𝗡*\n│ ⟡ *𝗨𝗦𝗘* : \`.antilink\``;
                await sock.sendMessage(chatId, { text: ui }, { quoted: message });
                break;
            }
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antilink command_*' }, { quoted: message });
    }
}

module.exports = {
    handleAntilinkCommand
};
