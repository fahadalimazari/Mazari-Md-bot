const { getSessionId, readSessionData } = require('../lib/sessionManager');

async function warningsCommand(sock, chatId, mentionedJidList) {
    const sessionId = getSessionId(sock);
    const warnings = readSessionData(sessionId, 'warnings.json', {});

    if (mentionedJidList.length === 0) {
        await sock.sendMessage(chatId, { text: 'Please mention a user to check warnings.' });
        return;
    }

    const userToCheck = mentionedJidList[0];
    const warningCount = warnings[userToCheck] || 0;

    await sock.sendMessage(chatId, { text: `User has ${warningCount} warning(s).` });
}

module.exports = warningsCommand;
