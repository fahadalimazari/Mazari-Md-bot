const { setAdminlock, getAdminlock } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');

async function adminlockCommand(sock, chatId, senderId, args, message) {
    try {
        const isSenderSudo = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!isSenderSudo && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* ⎔ 〕\n│ ❌ *𝗢𝗡𝗟𝗬 𝗢𝗪𝗡𝗘𝗥 𝗖𝗔𝗡 𝗨𝗦𝗘 𝗧𝗛𝗜𝗦*' }, { quoted: message });
            return;
        }

        const action = args[0]?.toLowerCase();
        if (action === 'on') {
            await setAdminlock(chatId, true);
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* ⎔ 〕\n│ 🔒 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗔𝗗𝗠𝗜𝗡 𝗖𝗛𝗔𝗡𝗚𝗘𝗦 𝗔𝗥𝗘 𝗡𝗢𝗪 𝗟𝗢𝗖𝗞𝗘𝗗*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else if (action === 'off') {
            await setAdminlock(chatId, false);
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* ⎔ 〕\n│ 🔓 *𝗦𝗧𝗔𝗧𝗨𝗦* : *𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*\n│ ✦ *𝗔𝗗𝗠𝗜𝗡 𝗖𝗛𝗔𝗡𝗚𝗘𝗦 𝗔𝗥𝗘 𝗡𝗢𝗪 𝗔𝗟𝗟𝗢𝗪𝗘𝗗*`;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        } else {
            const status = await getAdminlock(chatId);
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* ⎔ 〕\n│ 🛡️ *𝗦𝗧𝗔𝗧𝗨𝗦* : ${status ? '*𝗔𝗖𝗧𝗜𝗩𝗘*' : '*𝗜𝗡𝗔𝗖𝗧𝗜𝗩𝗘*'}\n│ ⟡ *𝗨𝗦𝗘* : \`.adminlock on\` / \`.adminlock off\``;
            await sock.sendMessage(chatId, { text: ui }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in adminlock command:', error);
    }
}

async function handleAdminlockPromotion(sock, groupId, participants, author) {
    try {
        const isEnabled = await getAdminlock(groupId);
        if (!isEnabled) return;

        const normalizeJid = (jid) => {
            if (!jid) return "";
            let str = typeof jid === 'string' ? jid : (jid.id || jid.toString() || "");
            if (str.includes(':')) str = str.split(':')[0] + '@' + str.split('@')[1];
            if (!str.includes('@')) str += '@s.whatsapp.net';
            return str;
        };

        const authorJid = normalizeJid(author);
        if (!authorJid) return;

        // If the bot itself did the action, ignore to prevent loops
        const botJid = normalizeJid(sock.user?.id);
        const botLid = sock.user?.lid ? normalizeJid(sock.user.lid) : null;
        if (authorJid === botJid || (botLid && authorJid === botLid)) {
            return;
        }

        // Owner/Sudo Bypass: Action performer is Bot Owner or Sudo user
        if (await isOwnerOrSudo(authorJid, sock, groupId)) {
            return;
        }

        // Check if bot is admin and get group owner
        let groupOwner = "";
        let botIsAdmin = false;
        try {
            const meta = await sock.groupMetadata(groupId);
            groupOwner = normalizeJid(meta.owner || meta.subjectOwner);
            
            const botParticipant = meta.participants?.find(p => {
                const pJid = normalizeJid(p.id);
                return pJid === botJid || (botLid && pJid === botLid);
            });
            botIsAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
        } catch (e) {}

        if (!botIsAdmin) {
            console.log(`🚨 [ADMINLOCK] Cannot reverse promotion. Bot is not admin in ${groupId}`);
            return; // Cannot demote if bot is not admin
        }

        if (authorJid === groupOwner) {
            return; // Group owner has full control
        }

        const demoteList = [];
        
        // 1. Demote the promoter (author)
        if (authorJid !== groupOwner && authorJid !== botJid && authorJid !== botLid) {
            demoteList.push(authorJid);
        }

        // 2. Demote the promoted targets (undo their promotion)
        for (const p of participants) {
            const targetJid = normalizeJid(p);
            if (targetJid && targetJid !== groupOwner && targetJid !== botJid && targetJid !== botLid && !demoteList.includes(targetJid)) {
                demoteList.push(targetJid);
            }
        }

        if (demoteList.length > 0) {
            console.log(`🚨 [ADMINLOCK] Reversing Promotion (Author: ${authorJid}):`, demoteList);
            
            // Execute demotions one by one to prevent batching failures
            for (const jid of demoteList) {
                try {
                    await sock.groupParticipantsUpdate(groupId, [jid], 'demote');
                } catch (e) {
                    console.error(`🚨 [ADMINLOCK] Failed to demote ${jid}:`, e.message);
                }
            }
            
            const authorShort = authorJid.split('@')[0].split(':')[0];
            const ui = `╭─〔 *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* 〕\n│ ⚠️ *𝗨𝗡𝗔𝗨𝗧𝗛𝗢𝗥𝗜𝗭𝗘𝗗*\n│ 👤 @${authorShort}\n╰────────────────╯`;
            
            const mentions = [authorJid, ...participants.map(p => normalizeJid(p))];
            
            await sock.sendMessage(groupId, { 
                text: ui,
                mentions: mentions
            });
        }
    } catch (error) {
        console.error('Error in handleAdminlockPromotion:', error);
    }
}

async function handleAdminlockDemotion(sock, groupId, participants, author) {
    try {
        const isEnabled = await getAdminlock(groupId);
        if (!isEnabled) return;

        const normalizeJid = (jid) => {
            if (!jid) return "";
            let str = typeof jid === 'string' ? jid : (jid.id || jid.toString() || "");
            if (str.includes(':')) str = str.split(':')[0] + '@' + str.split('@')[1];
            if (!str.includes('@')) str += '@s.whatsapp.net';
            return str;
        };

        const authorJid = normalizeJid(author);
        if (!authorJid) return;

        // If the bot itself did the action, ignore to prevent loops
        const botJid = normalizeJid(sock.user?.id);
        const botLid = sock.user?.lid ? normalizeJid(sock.user.lid) : null;
        if (authorJid === botJid || (botLid && authorJid === botLid)) {
            return;
        }

        // Owner/Sudo Bypass: Action performer is Bot Owner or Sudo user
        if (await isOwnerOrSudo(authorJid, sock, groupId)) {
            return;
        }

        // Check if bot is admin and get group owner
        let groupOwner = "";
        let botIsAdmin = false;
        try {
            const meta = await sock.groupMetadata(groupId);
            groupOwner = normalizeJid(meta.owner || meta.subjectOwner);

            const botParticipant = meta.participants?.find(p => {
                const pJid = normalizeJid(p.id);
                return pJid === botJid || (botLid && pJid === botLid);
            });
            botIsAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
        } catch (e) {}

        if (!botIsAdmin) {
            console.log(`🚨 [ADMINLOCK] Cannot reverse demotion. Bot is not admin in ${groupId}`);
            return;
        }

        if (authorJid === groupOwner) {
            return; // Group owner has full control
        }

        const promoteList = [];
        const demoteList = [];

        // 1. Promote back the demoted targets
        for (const p of participants) {
            const targetJid = normalizeJid(p);
            if (targetJid && targetJid !== groupOwner && targetJid.length > 5) {
                promoteList.push(targetJid);
            }
        }

        // 2. Demote the demoter (author)
        if (authorJid !== groupOwner && authorJid !== botJid && authorJid !== botLid && authorJid.length > 5) {
            demoteList.push(authorJid);
        }

        let actionTaken = false;

        if (promoteList.length > 0) {
            console.log(`🚨 [ADMINLOCK] Reversing Demotion - Promoting back targets:`, promoteList);
            for (const jid of promoteList) {
                try {
                    await sock.groupParticipantsUpdate(groupId, [jid], 'promote');
                    actionTaken = true;
                } catch (e) {
                    console.error(`🚨 [ADMINLOCK] Failed to promote back ${jid}:`, e.message);
                }
            }
        }

        if (demoteList.length > 0) {
            console.log(`🚨 [ADMINLOCK] Reversing Demotion - Demoting author (${authorJid}):`, demoteList);
            for (const jid of demoteList) {
                try {
                    await sock.groupParticipantsUpdate(groupId, [jid], 'demote');
                    actionTaken = true;
                } catch (e) {
                    console.error(`🚨 [ADMINLOCK] Failed to demote ${jid}:`, e.message);
                }
            }
        }

        if (actionTaken) {
            const authorShort = authorJid.split('@')[0].split(':')[0];
            const ui = `╭─〔 *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* 〕\n│ ⚠️ *𝗨𝗡𝗔𝗨𝗧𝗛𝗢𝗥𝗜𝗭𝗘𝗗*\n│ 👤 @${authorShort}\n╰────────────────╯`;
            
            await sock.sendMessage(groupId, { 
                text: ui,
                mentions: [authorJid]
            });
        }

    } catch (error) {
        console.error('Error in handleAdminlockDemotion:', error);
    }
}

module.exports = { adminlockCommand, handleAdminlockPromotion, handleAdminlockDemotion };
