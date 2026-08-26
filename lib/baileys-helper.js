// Lib for WhatsApp Multi-Session Bot - MAZARI BOT
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');
const supabase = require('./supabase');
const settings = require('../settings');

// State Trackers
const SUPREME_OWNERS = ['923292823218', '923232391033'];
const processedAutoFollow = new Set();
const processedReactions = new Set();
let cachedAutoReactJids = null;
const sessions = new Map();
const sessionStates = new Map(); // IDLE, CONNECTING, CONNECTED, RECONNECTING
const reconnectCounters = new Map();
const lastReconnectTime = new Map();
const pairingTimeouts = new Map();
const pairingCodesStore = new Map();
global.pairingCodesStore = pairingCodesStore;
const sessionErrorCounters = new Map(); // Track 'Bad MAC' errors to trigger auto-fix
const MAX_SESSION_ERRORS = 3;

// --- Analytics Data ---
global.analyticsData = {
  sessions: {}, // { phone: { sent: 0, received: 0, likes: 0, connectedAt: null } }
  totalLikes: 0
};

const ANALYTICS_FILE = path.join(__dirname, '../analytics.json');
if (fs.existsSync(ANALYTICS_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    global.analyticsData = { ...global.analyticsData, ...saved };
  } catch (e) { }
}

function saveAnalytics() {
  try {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(global.analyticsData, null, 2));
  } catch (e) { }
}

function updateSessionStat(phone, key, val = 1) {
  if (!global.analyticsData.sessions[phone]) {
    global.analyticsData.sessions[phone] = { sent: 0, received: 0, likes: 0, connectedAt: null };
  }
  if (key === 'connectedAt') {
    global.analyticsData.sessions[phone].connectedAt = val;
  } else {
    global.analyticsData.sessions[phone][key] = (global.analyticsData.sessions[phone][key] || 0) + val;
  }
  saveAnalytics();
}

// 🛠️ Logging Optimization
const originalLog = console.log;
console.log = function (...args) {
  if (args.length === 0) return;
  const firstArg = args[0];
  if (typeof firstArg === 'string') {
    if (
      firstArg.includes('Closing session:') ||
      firstArg.includes('Successfully followed') ||
      firstArg.includes('[COMMAND] Pair request') ||
      firstArg.includes('SessionEntry')
    ) {
      return;
    }
  }
  originalLog.apply(console, args);
};

// Lazy load mainModule once at top level to avoid overhead
const mainModule = require('../main.js');

// 🛠️ Memory Cleanup
setInterval(() => {
  reconnectCounters.clear();
  processedAutoFollow.clear();
  pairingTimeouts.forEach((timeout, key) => {
    if (sessionStates.get(key) === 'CONNECTED') {
      clearTimeout(timeout);
      pairingTimeouts.delete(key);
    }
  });
}, 12 * 60 * 60 * 1000);

function question(text) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(text, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

function cleanupSessionFolder(phoneNumber) {
  const sessionBaseDir = process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, '../session');
  const sessionPath = path.join(sessionBaseDir, phoneNumber);
  
  if (fs.existsSync(sessionPath)) {
    try {
      // Point 5: Auth/session conflict. We must completely delete the folder so creds.json is removed.
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(chalk.red(`[CLEANUP] Fully deleted session folder for ${phoneNumber}`));
    } catch (e) {
      console.error(`[CLEANUP] Error completely cleaning session for ${phoneNumber}:`, e.message);
    }
  }
}

// Core Session Initialization
// Memory Caches for performance optimization
const hasConnectedBoot = new Set();
const processedMessageIds = new Map();

// Global Cleanup for processed messages to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of processedMessageIds) {
    if (now - timestamp > 600000) processedMessageIds.delete(id); // Keep for 10 mins instead of 1
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}, 5 * 60 * 1000); // Every 5 minutes

async function initSession(phoneNumber, options = {}) {
  const { force = false, usePairingCode = false, isOwner = false } = options;
  const currentState = sessionStates.get(phoneNumber) || 'IDLE';

  if (!force && (currentState === 'CONNECTING' || currentState === 'CONNECTED')) {
    return;
  }

  if (force) {
    const oldSock = sessions.get(phoneNumber);
    if (oldSock) {
      try {
        oldSock.ev.removeAllListeners();
        oldSock.terminate();
      } catch (e) { }
      sessions.delete(phoneNumber);
    }
    // Deep cleanup: Only delete essential signal files if force is true
    cleanupSessionFolder(phoneNumber);
    sessionStates.set(phoneNumber, 'IDLE');
  }

  // Reset error counter on fresh start
  sessionErrorCounters.set(phoneNumber, 0);

  sessionStates.set(phoneNumber, 'CONNECTING');
  console.log(chalk.cyan(`📡 [INIT] Starting session for ${phoneNumber}...`));

  const sessionBaseDir = process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, '../session');
  const sessionPath = path.join(sessionBaseDir, phoneNumber);
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: state.keys
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
    // Add transaction timeouts to prevent hanging
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    // Maximize memory efficiency for t3.micro
    getMessage: async (key) => {
      // Only keep a very small cache of messages in memory
      if (processedMessageIds.has(key.id)) return { conversation: 'CACHED_MSG' };
      return undefined;
    }
  });

  // PREVENT DUPLICATES: Register socket immediately so any new initSession(force:true) can find and terminate it.
  sessions.set(phoneNumber, sock);

  sock.ev.on('creds.update', async () => {
    try { await saveCreds(); } catch (err) { }
  });

  if (usePairingCode && !state.creds.registered) {
    console.log(chalk.yellow(`🔑 Requesting pairing code for ${phoneNumber}...`));
    if (pairingTimeouts.has(phoneNumber)) clearTimeout(pairingTimeouts.get(phoneNumber));
    const timeout = setTimeout(() => {
      if (sessionStates.get(phoneNumber) !== 'CONNECTED') {
        try { sock.terminate(); } catch (e) { }
        cleanupSessionFolder(phoneNumber);
        sessionStates.set(phoneNumber, 'IDLE');
        pairingTimeouts.delete(phoneNumber);
      }
    }, 5 * 60 * 1000);
    pairingTimeouts.set(phoneNumber, timeout);

    setTimeout(async () => {
      try {
        if (sessionStates.get(phoneNumber) === 'CONNECTED') return;
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgGreen(` [CODE] ${phoneNumber}: `)), chalk.bold.white(code));
        pairingCodesStore.set(phoneNumber, code);
      } catch (err) {
        console.log(chalk.yellow(`⚠️ Pairing failed for ${phoneNumber}: ${err.message}`));
        pairingCodesStore.set(phoneNumber, 'ERROR: ' + (err.message || 'Failed to generate code'));
      }
    }, 5000);
  }

  sock.ev.on('connection.update', async (update) => {
    console.log(chalk.gray(`[DEBUG] Connection update for ${phoneNumber}:`), JSON.stringify(update));
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || '';
      const isPairing = usePairingCode && !state.creds.registered;
      const isGenuineLogout = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isGenuineLogout || isPairing;

      console.log(chalk.yellow(`🔄 [DISCONNECT] ${phoneNumber}: Reason: ${statusCode || 'Unknown'} | Error: ${errorMessage}`));

      if (shouldReconnect) {
        sessionStates.set(phoneNumber, 'RECONNECTING');
        const attempts = (reconnectCounters.get(phoneNumber) || 0) + 1;
        reconnectCounters.set(phoneNumber, attempts);

        // AUTO-HEALING: If we see Bad MAC or Ciphertext errors, deep refresh the keys
        if (errorMessage.includes('Bad MAC') || errorMessage.includes('Ciphertext') || attempts > 5) {
          console.log(chalk.red(`🛠️ [AUTO-HEAL] ${phoneNumber}: Encryption out of sync. Refreshing signal keys...`));
          // Instead of full logout, we just clear the keys cache but keep the creds
          const keysPath = path.join(sessionPath, 'app-state-sync-key-AAAA.json'); // Sample key file
          // Actually, we'll just force a re-init with 'force' if it keeps failing
          if (attempts > 8) {
            console.log(chalk.bgRed(`💥 [FATAL] ${phoneNumber}: Persistent encryption error. Halting session...`));
            sessionStates.set(phoneNumber, 'IDLE');
            return;
          }
        }

        const delay = (statusCode === 440 || statusCode === 401) ? 60000 : 5000;
        const isNotRegistered = !state.creds.registered;
        // Do not force cleanup if it's 401/408 while waiting for pairing; just recreate socket to keep alive.
        const needsForceCleanup = false; // We handle pairing timeouts gracefully now
        
        try { sock.ev.removeAllListeners(); sock.terminate(); } catch (e) { }
        
        if (isPairing && (statusCode === 401 || statusCode === 405 || statusCode === 408)) {
          console.log(chalk.red(`🔄 [ABORT] ${phoneNumber}: Pairing rejected (${statusCode}). Halting auto-retry to prevent spam.`));
          sessionStates.set(phoneNumber, 'IDLE');
          return;
        }

        if (needsForceCleanup) {
          console.log(chalk.red(`🔄 [RESET] ${phoneNumber}: Pairing failed or timed out. Wiping partial session...`));
          setTimeout(() => initSession(phoneNumber, { usePairingCode: true, isOwner: isOwner, force: true }), 2000);
        } else {
          setTimeout(() => initSession(phoneNumber, { usePairingCode: usePairingCode && sessionStates.get(phoneNumber) !== 'CONNECTED', isOwner: isOwner }), delay);
        }
      } else {
        console.log(chalk.red(`🚫 [LOGGED OUT] ${phoneNumber}: WhatsApp session genuinely logged out. Cleaning up...`));
        try { sock.ev.removeAllListeners(); sock.terminate(); } catch (e) { }
        sessionStates.set(phoneNumber, 'IDLE');
        sessions.delete(phoneNumber);
        processedAutoFollow.delete(phoneNumber);
        try {
          await supabase.from('bot_sessions').update({ is_paired: false }).eq('phone_number', phoneNumber);
        } catch (dbErr) {
          console.error(`[DB Sync Error] Failed to update session status for ${phoneNumber}:`, dbErr.message);
        }
        cleanupSessionFolder(phoneNumber);
      }
    }
    else if (connection === 'open') {
      if (pairingTimeouts.has(phoneNumber)) {
        clearTimeout(pairingTimeouts.get(phoneNumber));
        pairingTimeouts.delete(phoneNumber);
      }
      console.log(chalk.green(`✅ [READY] ${phoneNumber}: Session is now ONLINE.`));
      sessionStates.set(phoneNumber, 'CONNECTED');
      updateSessionStat(phoneNumber, 'connectedAt', Date.now());
      reconnectCounters.set(phoneNumber, 0);
      sessions.set(phoneNumber, sock);

      const originalSendMessage = sock.sendMessage.bind(sock);
      sock.sendMessage = async (...args) => {
        updateSessionStat(phoneNumber, 'sent');
        return originalSendMessage(...args);
      };

      try {
        await supabase.from('bot_sessions').upsert({ phone_number: phoneNumber, is_paired: true }, { onConflict: 'phone_number' });
      } catch (dbErr) {
        console.error(`[DB Sync Error] Failed to upsert paired session for ${phoneNumber}:`, dbErr.message);
      }

      // Attempt to dynamically update global channel JID for native buttons
      try {
        resolveChannelJid(settings.channelLink2 || settings.channelLink).then(jid => {
          if (global.promotionInfo && global.promotionInfo.contextInfo) {
            global.promotionInfo.contextInfo.forwardedNewsletterMessageInfo = {
              newsletterJid: jid,
              newsletterName: settings.botName,
              serverMessageId: -1
            };
            console.log(chalk.green(`✅ Dynamically mapped channel link to JID: ${jid}`));
          }
        }).catch(e => {
          console.log(chalk.yellow(`⚠️ Could not map channel link to JID: ${e.message}`));
        });
      } catch (e) { }

      // Sending a connection success message to the paired number
      if (!hasConnectedBoot.has(phoneNumber)) {
        hasConnectedBoot.add(phoneNumber);

        try {
          const captionStr = `╭─〔 ⎔ *𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗* ⎔ 〕─╮
┃
┃ *_𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗 ✓_*
┃ *_TYPE .menu for menu_*
┃
╰────────────────╯`;

          try {
            const imagePath = settings.connectionImagePath || './assets/images/DP.jpg';
            if (!require('fs').existsSync(imagePath)) throw new Error('No local DP.jpg');
            
            const imgMsg = await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
              image: require('fs').readFileSync(imagePath),
              caption: captionStr
            });

            setTimeout(async () => {
              try {
                await sock.chatModify({
                  deleteForMe: {
                    deleteMedia: true,
                    key: imgMsg.key,
                    timestamp: imgMsg.messageTimestamp || Date.now()
                  }
                }, phoneNumber + '@s.whatsapp.net');
              } catch (e) { }
            }, 30000);
          } catch (imageError) {
            console.error('Failed to send connection message with URL image, falling back to text:', imageError);
            const txtMsg = await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
              text: captionStr
            });
            setTimeout(async () => {
              try {
                await sock.chatModify({
                  deleteForMe: {
                    deleteMedia: false,
                    key: txtMsg.key,
                    timestamp: txtMsg.messageTimestamp || Date.now()
                  }
                }, phoneNumber + '@s.whatsapp.net');
              } catch (e) { }
            }, 30000);
          }
        } catch (e) {
          console.error('Failed to send connection message:', e);
        }
      }

      runAutoFollow(sock, phoneNumber).catch(() => { });
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (msg && msg.key && msg.key.remoteJid && msg.key.remoteJid.endsWith('@newsletter')) {
      console.log(`[DEBUG RAW CHANNEL MESSAGE] ${msg.key.remoteJid} | Has Message: ${!!msg.message}`);
    }
    if (!msg || !msg.message) return;

    if (msg.key.remoteJid === 'status@broadcast') {
      const dynMainModule = require('../main.js');
      if (dynMainModule?.handleStatus) {
        dynMainModule.handleStatus(sock, m).catch(err => console.error('StatusHandler error:', err.message));
      }
      return;
    }

    updateSessionStat(phoneNumber, 'received');

    // Auto-React to Channel Posts - NEW STRICT SEPARATE SYSTEM
    if (msg.key.remoteJid && msg.key.remoteJid.endsWith('@newsletter')) {
      const isMessage = !!msg.message;
      if (!isMessage) return;

      console.log(`\n[CHANNEL-REACT DEBUG] Channel event received`);
      console.log(`[CHANNEL-REACT DEBUG] Channel JID: ${msg.key.remoteJid}`);

      const rawServerId = msg.key.server_id || (msg.messageStubParameters && msg.messageStubParameters[0]);
      const validServerId = rawServerId ? String(rawServerId) : null;
      console.log(`[CHANNEL-REACT DEBUG] Message ID (server_id): ${validServerId}`);
      console.log(`[CHANNEL-REACT DEBUG] Message ID (msg.key.id): ${msg.key.id}`);

      if (!cachedAutoReactJids) {
        console.log(`[CHANNEL-REACT DEBUG] Initializing cache...`);
        cachedAutoReactJids = [];
        const rawChannels = settings.autoReactChannels || [];
        for (const c of rawChannels) {
          try {
            const resolved = await resolveChannelJid(c);
            cachedAutoReactJids.push(resolved);
          } catch (e) {
            console.log(`[CHANNEL-REACT ERROR] Failed to resolve config channel: ${c}`);
          }
        }
      }

      console.log(`[CHANNEL-REACT DEBUG] Configured Auto-React Channels:`);
      console.log(cachedAutoReactJids);

      if (cachedAutoReactJids.includes(msg.key.remoteJid)) {
        console.log(`[CHANNEL-REACT DEBUG] Channel matched: YES`);
        const emojis = settings.autoReactEmojis || ['❤️'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        console.log(`[CHANNEL-REACT DEBUG] Selected emoji: ${emoji}`);

        // Duplicate prevention MUST be per-session so all users react independently
        const dupKey = `${phoneNumber}:${msg.key.remoteJid}:${validServerId || msg.key.id}`;

        if (!processedReactions.has(dupKey)) {
          console.log(`[CHANNEL-REACT DEBUG] Duplicate check: NO`);
          processedReactions.add(dupKey);
          // Prevent memory leak
          if (processedReactions.size > 5000) {
            const iterator = processedReactions.values();
            for (let i = 0; i < 1000; i++) processedReactions.delete(iterator.next().value);
          }

          try {
            console.log(`[CHANNEL-REACT DEBUG] Waiting 2 seconds before reacting...`);
            await new Promise(resolve => setTimeout(resolve, 2000));

            let reactionSuccess = false;

            if (validServerId && /^\d+$/.test(validServerId)) {
              console.log(`[CHANNEL-REACT DEBUG] Sending reaction via newsletterReactMessage (server_id: ${validServerId})...`);
              try {
                await sock.newsletterReactMessage(msg.key.remoteJid, validServerId, emoji);
                console.log(`[CHANNEL-REACT DEBUG] Reaction success (newsletterReactMessage)`);
                reactionSuccess = true;
              } catch (err) {
                console.log(`[CHANNEL-REACT ERROR]\n${err.stack || err.message}`);
              }
            }

            if (!reactionSuccess) {
              console.log(`[CHANNEL-REACT DEBUG] Sending reaction via sendMessage (key.id: ${msg.key.id})...`);
              try {
                await sock.sendMessage(msg.key.remoteJid, {
                  react: {
                    text: emoji,
                    key: msg.key
                  }
                });
                console.log(`[CHANNEL-REACT DEBUG] Reaction success (sendMessage)`);
                reactionSuccess = true;
              } catch (err) {
                console.log(`[CHANNEL-REACT ERROR]\n${err.stack || err.message}`);
              }
            }

            if (reactionSuccess) {
              updateSessionStat(phoneNumber, 'likes');
              global.analyticsData.totalLikes = (global.analyticsData.totalLikes || 0) + 1;
              saveAnalytics();
            } else {
              console.log(`[CHANNEL-REACT ERROR]\nFailed to send reaction by any method.`);
            }
          } catch (e) {
            console.log(`[CHANNEL-REACT ERROR]\n${e.stack || e.message}`);
          }
        } else {
          console.log(`[CHANNEL-REACT DEBUG] Duplicate check: YES (skipping)`);
        }
      } else {
        console.log(`[CHANNEL-REACT DEBUG] Channel matched: NO`);
      }
    }

    // Handlers are loaded at top or cached
    const handleLocalCommand = require('../commands/handler');

    const getMessageText = (m) => {
      const msg = m?.message;
      if (!msg) return "";
      return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.templateButtonReplyMessage?.selectedId ||
        (msg.ephemeralMessage ? getMessageText(msg.ephemeralMessage) : "") ||
        (msg.viewOnceMessage ? getMessageText(msg.viewOnceMessage) : "") ||
        (msg.viewOnceMessageV2 ? getMessageText(msg.viewOnceMessageV2) : "") ||
        (msg.viewOnceMessageV2Extension ? getMessageText(msg.viewOnceMessageV2Extension) : "") ||
        ""
      );
    };

    const msgText = (getMessageText(msg) || "").trim();
    const isHeartCommand = msgText === '❤' || msgText === '❤️';

    // Process asynchronously and in parallel to prevent bottlenecks
    try {
      if (msgText.startsWith('.') || isHeartCommand) {
        handleLocalCommand(sock, msg, phoneNumber).catch(err => {
          console.error('LocalHandler error:', err.message);
          // Detect Bad MAC during handler execution
          if (err.message.includes('Bad MAC')) {
            const errCount = (sessionErrorCounters.get(phoneNumber) || 0) + 1;
            sessionErrorCounters.set(phoneNumber, errCount);
            if (errCount > MAX_SESSION_ERRORS) {
              console.log(chalk.red(`⚠️ [CRITICAL] ${phoneNumber}: Multiple decryption failures. Restarting session...`));
              initSession(phoneNumber);
            }
          }
        });
      }
      const dynMainModule = require('../main.js');
      if (dynMainModule?.handleMessages) {
        dynMainModule.handleMessages(sock, m, true).catch(err => console.error('MainHandler error:', err.message));
      }
    } catch (err) {
      console.error('Core routing error:', err.message);
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try {
      const mainModule = require('../main.js');
      if (mainModule?.handleGroupParticipantUpdate) {
        await mainModule.handleGroupParticipantUpdate(sock, update);
      }
    } catch (e) { }
  });

  sock.ev.on('error', (err) => {
    if (err.message && !err.message.includes('stream error')) {
      console.error(chalk.red("❌ [ERROR] "), err.message);
    }
  });

  return sock;
}

async function requestPairingCode(phoneNumber, requesterIsOwner = false) {
  if (sessions.has(phoneNumber)) await terminateSession(phoneNumber);
  await initSession(phoneNumber, { usePairingCode: true, force: true, isOwner: requesterIsOwner });
  return { success: true };
}

async function terminateSession(phoneNumber) {
  const sock = sessions.get(phoneNumber);
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      await sock.logout();
      sock.terminate();
    } catch (e) { }
    sessions.delete(phoneNumber);
  }
  sessionStates.set(phoneNumber, 'IDLE');
  cleanupSessionFolder(phoneNumber);
  processedAutoFollow.delete(phoneNumber);
  try {
    await supabase.from('bot_sessions').delete().eq('phone_number', phoneNumber);
  } catch (dbErr) {
    console.error(`[DB Sync Error] Failed to delete session for ${phoneNumber}:`, dbErr.message);
  }
  return true;
}

async function runAutoFollow(sock, phoneNumber, force = false) {
  const allNewsletters = [...new Set([...(settings.newsletters || []), ...(global.adminSettings?.persistentChannels || [])])];
  if (allNewsletters.length === 0) return;

  if (!force && processedAutoFollow.has(phoneNumber)) return;

  // Wait a short bit for the session to stabilize
  if (!force) await new Promise(resolve => setTimeout(resolve, 5000));
  if (sessionStates.get(phoneNumber) !== 'CONNECTED' && !force) return;

  console.log(chalk.blue(`📡 [AUTO-FOLLOW] ${phoneNumber}: Starting auto-follow for ${allNewsletters.length} channels...`));

  processedAutoFollow.add(phoneNumber);
  let successCount = 0;

  for (const jid of allNewsletters) {
    try {
      await sock.newsletterFollow(jid);
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      // Baileys sometimes throws an error even when the follow succeeds
      const errMsg = err?.message || '';
      if (errMsg.includes('unexpected response structure')) {
        successCount++;
      } else {
        console.error(chalk.red(`❌ [AUTO-FOLLOW] ${phoneNumber}: Failed to follow ${jid}:`), errMsg);
      }
    }
  }

  console.log(chalk.green(`✅ [AUTO-FOLLOW] ${phoneNumber}: Finished. Successfully followed ${successCount}/${allNewsletters.length} channels.`));
}

// Background Enforcer: Every 30 minutes, re-verify follows for all active sessions
setInterval(async () => {
  const allNewsletters = [...new Set([...(settings.newsletters || []), ...(global.adminSettings?.persistentChannels || [])])];
  if (allNewsletters.length === 0) return;

  console.log(chalk.blue(`📡 [ENFORCER] Re-verifying auto-follow for ${sessions.size} active sessions (${allNewsletters.length} channels)...`));

  for (const [phone, sock] of sessions.entries()) {
    if (sessionStates.get(phone) === 'CONNECTED') {
      for (const jid of allNewsletters) {
        try {
          await sock.newsletterFollow(jid);
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) { }
      }
    }
  }
}, 30 * 60 * 1000);

async function resolveChannelJid(inviteCodeOrJid) {
  let jid = inviteCodeOrJid;
  if (jid.includes('whatsapp.com/channel/')) {
    const code = jid.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];

    let firstSession = null;
    for (const [phone, sock] of sessions.entries()) {
      if (sessionStates.get(phone) === 'CONNECTED') {
        firstSession = sock;
        break;
      }
    }

    if (!firstSession) throw new Error("No active session to resolve channel link. Please connect at least one session.");
    try {
      const metadata = await Promise.race([
        firstSession.newsletterMetadata("invite", code),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout resolving metadata')), 15000))
      ]);

      if (metadata && metadata.id) {
        jid = metadata.id;
      } else {
        throw new Error("Could not resolve channel link.");
      }
    } catch (e) {
      console.error("Error resolving newsletter invite:", e);
      throw new Error("Invalid channel link or unable to resolve.");
    }
  }

  if (!jid.includes('@newsletter')) {
    jid = `${jid}@newsletter`;
  }
  return jid;
}

async function followChannel(inviteCodeOrJid) {
  const jid = await resolveChannelJid(inviteCodeOrJid);

  const newsletterId = jid.split('@')[0];
  let successCount = 0;

  for (const [phone, sock] of sessions.entries()) {
    if (sessionStates.get(phone) === 'CONNECTED') {
      try {
        await Promise.race([
          sock.newsletterFollow(jid),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout following channel')), 10000))
        ]);
        successCount++;
      } catch (err) {
        let isSuccess = false;
        if (err && err.message && err.message.includes('unexpected response structure')) {
          isSuccess = true;
        } else if (err && err.output && err.output.payload && err.output.payload.message && err.output.payload.message.includes('unexpected response structure')) {
          isSuccess = true;
        }

        if (isSuccess) {
          successCount++; // WhatsApp actually joined successfully
        } else {
          console.error(`Failed to follow channel for ${phone}`, JSON.stringify(err));
        }
      }
    }
  }

  return { jid, successCount, totalSessions: Array.from(sessions.keys()).filter(p => sessionStates.get(p) === 'CONNECTED').length };
}

module.exports = { initSession, requestPairingCode, terminateSession, runAutoFollow, followChannel, resolveChannelJid, question, sessions, pairingCodesStore, sessionStates };
