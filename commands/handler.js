const { requestPairingCode, terminateSession, sessions, runAutoFollow, pairingCodesStore, sessionStates } = require('../lib/baileys-helper');
const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const chalk = require('chalk');

// Core Admin List - ONLY these can unpair
const SUPREME_OWNERS = ['923223602988'];

async function handleCommand(sock, m, currentSessionPhone) {
  const remoteJid = m.key.remoteJid;
  const sender = m.key.participant || remoteJid;
  const senderNumber = sender.split(':')[0].split('@')[0];
  const isOwner = SUPREME_OWNERS.includes(senderNumber);

  const getMessageText = (m) => {
    const msg = m?.message;
    if (!msg) return "";
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage) return msg.extendedTextMessage.text;
    if (msg.imageMessage) return msg.imageMessage.caption;
    if (msg.videoMessage) return msg.videoMessage.caption;
    if (msg.buttonsResponseMessage) return msg.buttonsResponseMessage.selectedButtonId;
    if (msg.templateButtonReplyMessage) return msg.templateButtonReplyMessage.selectedId;
    if (msg.ephemeralMessage) return getMessageText({ message: msg.ephemeralMessage.message });
    if (msg.viewOnceMessage) return getMessageText({ message: msg.viewOnceMessage.message });
    if (msg.viewOnceMessageV2) return getMessageText({ message: msg.viewOnceMessageV2.message });
    if (msg.viewOnceMessageV2Extension) return getMessageText({ message: msg.viewOnceMessageV2Extension.message });
    return "";
  };

  const msgText = getMessageText(m).trim();
  if (!msgText.startsWith('.')) return;

  const args = msgText.slice(1).split(/\s+/);
  const command = args.shift().toLowerCase();

  switch (command) {
    // ping command removed to prevent duplicate response

    case 'pair': {
      const targetNumber = senderNumber;
      console.log(chalk.magenta(`✨ [COMMAND] Pair request for ${targetNumber}`));

      try {
        pairingCodesStore.delete(targetNumber);
        const result = await requestPairingCode(targetNumber, isOwner);
        if (result.success) {
          let realCode = null;
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            realCode = pairingCodesStore.get(targetNumber);
            if (realCode || sessionStates.get(targetNumber) === 'CONNECTED') break;
          }

          if (realCode) {
            await sock.sendMessage(remoteJid, { text: realCode });
          } else if (sessionStates.get(targetNumber) === 'CONNECTED') {
            await sock.sendMessage(remoteJid, { text: '✅ Number already connected!' }, { quoted: m });
          } else {
            throw new Error('Timeout waiting for code.');
          }
        } else {
          throw new Error(result.error || 'Pairing initialization failed.');
        }
      } catch (err) {
        console.error(`❌ [PAIR ERROR]:`, err.message);
        await sock.sendMessage(remoteJid, { text: `❌ Failed: ${err.message}` }, { quoted: m });
      }
      break;
    }

    case 'unpair': {
      if (!isOwner) {
        return await sock.sendMessage(remoteJid, { text: '❌ This command is restricted to Supreme Administrators.' }, { quoted: m });
      }

      let targetPhone = args[0] || currentSessionPhone;
      targetPhone = targetPhone.replace(/[^0-9]/g, '');

      if (!targetPhone) {
        return await sock.sendMessage(remoteJid, { text: '⚠️ Specify number: `.unpair 92xxxxxxxx`' }, { quoted: m });
      }

      console.log(chalk.red(`🧹 [COMMAND] Unpair request for ${targetPhone}`));

      try {
        await terminateSession(targetPhone);
        await sock.sendMessage(remoteJid, { text: `✅ Session ${targetPhone} has been completely removed.` }, { quoted: m });
      } catch (err) {
        await sock.sendMessage(remoteJid, { text: `❌ Error: ${err.message}` }, { quoted: m });
      }
      break;
    }



    case 'jid': {
      await sock.sendMessage(remoteJid, { text: `📍 *Your JID:* ${sender}` }, { quoted: m });
      break;
    }

    case 'testfollow': {
      if (!isOwner) {
        return await sock.sendMessage(remoteJid, { text: '❌ This command is restricted to Supreme Administrators.' }, { quoted: m });
      }

      let targetPhone = args[0] || currentSessionPhone || senderNumber;
      targetPhone = targetPhone.replace(/[^0-9]/g, '');

      if (!targetPhone) {
        return await sock.sendMessage(remoteJid, { text: '⚠️ Please specify number: `.testfollow 92xxxxxxxx`' }, { quoted: m });
      }

      const targetSock = sessions.get(targetPhone);
      if (!targetSock) {
        return await sock.sendMessage(remoteJid, { text: `❌ Session for ${targetPhone} is not active currently.` }, { quoted: m });
      }

      await sock.sendMessage(remoteJid, { text: `⏳ *Forcing Autofollow Test for ${targetPhone}...*\nPlease check server logs for detailed trace.` }, { quoted: m });

      try {
        await runAutoFollow(targetSock, targetPhone, true); // force = true
        await sock.sendMessage(remoteJid, { text: `✅ Autofollow execution finished for ${targetPhone}.\nVerify your channels.` }, { quoted: m });
      } catch (err) {
        await sock.sendMessage(remoteJid, { text: `❌ Critical Error: ${err.message}` }, { quoted: m });
      }
      break;
    }

    default:
      break;
  }
}

module.exports = handleCommand;
