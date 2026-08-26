const isAdmin = require('../lib/isAdmin');

async function approveCommand(sock, msg, args) {
    try {
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        
        if (!isGroup) {
            await sock.sendMessage(msg.key.remoteJid, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ⚠️ *This command can only be used in groups!*\n╰──────────────────────────────' }, { quoted: msg });
            return;
        }

        const groupId = msg.key.remoteJid;
        const { isBotAdmin } = await isAdmin(sock, groupId, sender);

        if (!isBotAdmin) {
            await sock.sendMessage(groupId, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ⚠️ *I need to be an admin to approve requests!*\n╰──────────────────────────────' }, { quoted: msg });
            return;
        }

        const countStr = args[0];
        let countToApprove = countStr ? parseInt(countStr) : Infinity;

        if (countStr && (isNaN(countToApprove) || countToApprove <= 0)) {
            await sock.sendMessage(groupId, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ⚠️ *Please provide a valid number!*\n│ 📝 *Example:* .approve 5\n│ ℹ️ *Or just .approve to approve all*\n╰──────────────────────────────' }, { quoted: msg });
            return;
        }

        // Fetch pending requests
        let pendingRequests;
        try {
            pendingRequests = await sock.groupRequestParticipantsList(groupId);
        } catch (err) {
            console.error('Error fetching requests:', err);
            await sock.sendMessage(groupId, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ❌ *Failed to fetch join requests!*\n│ ℹ️ *Ensure the group has "Approve New Participants" enabled.*\n╰──────────────────────────────' }, { quoted: msg });
            return;
        }

        if (!pendingRequests || pendingRequests.length === 0) {
            await sock.sendMessage(groupId, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ℹ️ *There are no pending join requests in this group.*\n╰──────────────────────────────' }, { quoted: msg });
            return;
        }

        // Filter valid requests and limit to countToApprove
        const jidsToApprove = pendingRequests.slice(0, countToApprove).map(req => req.jid);
        const actualApproveCount = jidsToApprove.length;

        if (actualApproveCount === 0) {
            await sock.sendMessage(groupId, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ℹ️ *No valid requests found to approve.*\n╰──────────────────────────────' }, { quoted: msg });
            return;
        }

        try {
            await sock.groupRequestParticipantsUpdate(groupId, jidsToApprove, 'approve');
            await sock.sendMessage(groupId, { text: `╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ✅ *Successfully approved ${actualApproveCount} join request(s)!*\n╰──────────────────────────────` }, { quoted: msg });
        } catch (err) {
            console.error('Error approving participants:', err);
            await sock.sendMessage(groupId, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ❌ *Failed to approve requests. Something went wrong.*\n╰──────────────────────────────' }, { quoted: msg });
        }

    } catch (error) {
        console.error('Error in approve command:', error);
        await sock.sendMessage(msg.key.remoteJid, { text: '╭─〔 ⎔ *𝗔𝗣𝗣𝗥𝗢𝗩𝗘 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦* ⎔ 〕\n│ ❌ *An unexpected error occurred!*\n╰──────────────────────────────' }, { quoted: msg });
    }
}

module.exports = { approveCommand };
