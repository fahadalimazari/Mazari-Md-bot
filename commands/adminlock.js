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
        if (authorJid === normalizeJid(sock.user.id) || (sock.user.lid && authorJid === normalizeJid(sock.user.lid))) {
            return;
        }

        // Owner/Sudo Bypass
        if (await isOwnerOrSudo(authorJid, sock, groupId)) {
            return;
        }

        // Check if author is group owner and bot is admin
        let groupOwner = "";
        let botIsAdmin = false;
        try {
            const meta = await sock.groupMetadata(groupId);
            groupOwner = normalizeJid(meta.owner || meta.subjectOwner);
            const botJid = normalizeJid(sock.user.id);
            
            // Check bot admin status
            const botParticipant = meta.participants.find(p => normalizeJid(p.id) === botJid);
            botIsAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
        } catch (e) {}

        if (!botIsAdmin) {
            console.log(`🚨 [ADMINLOCK] Cannot reverse promotion. Bot is not admin in ${groupId}`);
            return; // Cannot demote if bot is not admin
        }

        if (authorJid === groupOwner) {
            return; // Group owner has full control
        }

        const demoteSet = new Set();
        
        // 1. Demote the promoter
        demoteSet.add(authorJid);

        // 2. Demote the targets (undo their promotion)
        participants.forEach(p => {
            const targetJid = normalizeJid(p);
            if (targetJid && targetJid !== groupOwner) {
                demoteSet.add(targetJid);
            }
        });

        const demoteList = Array.from(demoteSet).filter(jid => {
            if (!jid) return false;
            if (jid === normalizeJid(sock.user.id)) return false; 
            if (sock.user.lid && jid === normalizeJid(sock.user.lid)) return false; 
            if (jid === groupOwner) return false;
            return jid.includes('@'); // Must be a valid JID
        });

        if (demoteList.length > 0) {
            console.log(`🚨 [ADMINLOCK] Reversing Promotion (Author: ${authorJid}):`, demoteList);
            
            // Execute demotions. Do it one by one to avoid Baileys batching issues where one failure aborts the whole array
            for (const jid of demoteList) {
                try {
                    await sock.groupParticipantsUpdate(groupId, [jid], 'demote');
                } catch (e) {
                    console.error(`🚨 [ADMINLOCK] Failed to demote ${jid}:`, e.message);
                }
            }
            
            const authorShort = authorJid.split('@')[0];
            const targetsShort = participants.map(p => `@${normalizeJid(p).split('@')[0]}`).join(', ');
            
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* ⎔ 〕\n│ ⚠️ *𝗨𝗡𝗔𝗨𝗧𝗛𝗢𝗥𝗜𝗭𝗘𝗗 𝗣𝗥𝗢𝗠𝗢𝗧𝗜𝗢𝗡*\n│ 👤 *𝗣𝗥𝗢𝗠𝗢𝗧𝗘𝗥* : @${authorShort}\n│ 👥 *𝗧𝗔𝗥𝗚𝗘𝗧𝗦* : ${targetsShort}\n│ 🔄 *𝗥𝗢𝗟𝗘𝗦 𝗥𝗘𝗩𝗘𝗥𝗦𝗘𝗗*\n│ ⚡ *𝗧𝗥𝗬 𝗔𝗚𝗔𝗜? 𝗡𝗔𝗛 — 𝗧𝗛𝗜𝗦 𝗚𝗥𝗢𝗨𝗣 𝗜𝗦 𝗟𝗢𝗖𝗞𝗘𝗗.*`;
            
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
        if (authorJid === normalizeJid(sock.user.id) || (sock.user.lid && authorJid === normalizeJid(sock.user.lid))) {
            return;
        }

        // Owner/Sudo Bypass
        if (await isOwnerOrSudo(authorJid, sock, groupId)) {
            return;
        }

        // Check if author is group owner
        let groupOwner = "";
        try {
            const meta = await sock.groupMetadata(groupId);
            groupOwner = normalizeJid(meta.owner || meta.subjectOwner);
        } catch (e) {}

        if (authorJid === groupOwner) {
            return; // Group owner has full control
        }

        const promoteSet = new Set();
        const demoteSet = new Set();

        // 1. Demote the demoter
        demoteSet.add(authorJid);

        // 2. Promote the targets back
        participants.forEach(p => {
            const targetJid = normalizeJid(p);
            if (targetJid && targetJid !== groupOwner) {
                promoteSet.add(targetJid);
            }
        });

        const demoteList = Array.from(demoteSet).filter(jid => {
            if (!jid) return false;
            if (jid === normalizeJid(sock.user.id)) return false; 
            if (sock.user.lid && jid === normalizeJid(sock.user.lid)) return false; 
            if (jid === groupOwner) return false;
            return jid.length > 5;
        });

        const promoteList = Array.from(promoteSet).filter(jid => {
            if (!jid) return false;
            return jid.length > 5;
        });

        let actionTaken = false;

        if (promoteList.length > 0) {
            console.log(`🚨 [ADMINLOCK] Reversing Demotion - Promoting back targets:`, promoteList);
            await sock.groupParticipantsUpdate(groupId, promoteList, 'promote');
            actionTaken = true;
        }

        if (demoteList.length > 0) {
            console.log(`🚨 [ADMINLOCK] Reversing Demotion - Demoting author (${authorJid}):`, demoteList);
            await sock.groupParticipantsUpdate(groupId, demoteList, 'demote');
            actionTaken = true;
        }

        if (actionTaken) {
            const ui = `╭─〔 ⎔ *𝗔𝗗𝗠𝗜𝗡 𝗟𝗢𝗖𝗞* ⎔ 〕\n│ ⚠️ *𝗨𝗡𝗔𝗨𝗧𝗛𝗢𝗥𝗜𝗭𝗘𝗗 𝗗𝗘𝗠𝗢𝗧𝗜𝗢𝗡*\n│ 👤 *𝗔𝗖𝗧𝗜𝗢𝗡 𝗕𝗬* : @${authorJid.split('@')[0]}\n│ 🔄 *𝗥𝗢𝗟𝗘𝗦 𝗥𝗘𝗩𝗘𝗥𝗦𝗘𝗗*\n│ ⚡ *𝗧𝗥𝗬 𝗔𝗚𝗔𝗜? 𝗡𝗔𝗛 — 𝗧𝗛𝗜𝗦 𝗚𝗥𝗢𝗨𝗣 𝗜𝗦 𝗟𝗢𝗖𝗞𝗘𝗗.*`;
            
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
