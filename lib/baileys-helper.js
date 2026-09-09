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
const capacityTracker = require('./capacity_tracker');
const { setOffline: registrySetOffline } = require('./server_registry');
const { randomUUID } = require('crypto');
function isRestoreable(phoneNumber, sessionData) {
    const sessionBaseDir = process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, '../session');
    const credsPath = path.join(sessionBaseDir, phoneNumber, 'creds.json');
    let hasValidLocalAuth = false;
    try {
        if (fs.existsSync(credsPath)) {
            const parsedCreds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            hasValidLocalAuth = parsedCreds.registered === true;
        }
    } catch(e) {}

    let hasValidBackup = false;
    try {
        const backupCreds = sessionData?.backup?.['creds.json'];
        if (backupCreds) {
            const parsed = typeof backupCreds === 'string' ? JSON.parse(backupCreds) : backupCreds;
            hasValidBackup = parsed.registered === true;
        }
    } catch(e) {}

    return hasValidLocalAuth || hasValidBackup;
}
// Ownership lock TTL (milliseconds) – must be greater than watchdog heartbeat interval
const HEARTBEAT_INTERVAL_MS = 45 * 1000; // 45 s
const OWNERSHIP_TTL_MS = 3 * 60 * 1000; // 3 minutes
// Map to store active heartbeat intervals per phone number
// Map to store active heartbeat intervals per phone number
const ownershipHeartbeats = new Map(); // phone → Interval ID
let _shuttingDown = false;

const sessionUpdateLocks = new Map();

/**
 * Safely updates session_data by fetching the latest row and merging.
 * Serializes writes per phone number to prevent race conditions.
 */
async function safeUpdateSessionData(phoneNumber, updaterFn) {
  if (!sessionUpdateLocks.has(phoneNumber)) {
    sessionUpdateLocks.set(phoneNumber, Promise.resolve());
  }

  const lock = sessionUpdateLocks.get(phoneNumber);
  const next = lock.then(async () => {
    try {
      if (supabase.isMock) return;
      const normReq = String(phoneNumber).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
      let { data } = await supabase
        .from('bot_sessions')
        .select('phone_number, session_data')
        .eq('phone_number', normReq)
        .maybeSingle();

      if (!data) {
        const { data: d2 } = await supabase
          .from('bot_sessions')
          .select('phone_number, session_data')
          .eq('phone_number', '+' + normReq)
          .maybeSingle();
        data = d2;
      }

      if (!data) {
          const { data: rpcData } = await supabase.rpc('get_all_sessions');
          if (rpcData) {
              const row = rpcData.find(r => String(r.phone_number).split(':')[0].split('@')[0].replace(/[^0-9]/g, '') === normReq);
              if (row) data = { phone_number: row.phone_number, session_data: row.session_data };
          }
      }

      const existing = data?.session_data || {};
      const newData = updaterFn(existing);
      
      if (!newData) return; // No change needed

      const actualDbPhone = data?.phone_number || normReq;

      if (!data) {
          // Fallback to claim_ownership if row is completely missing to bypass RLS
          const { error: claimErr } = await supabase.rpc('claim_ownership', {
              p_phone_number: actualDbPhone,
              p_new_owner: global.SERVER_ID,
              p_ttl_ms: 180000
          });
          if (claimErr) console.error(chalk.red(`[SESSION PERSIST ERROR] ${actualDbPhone} claim_ownership fallback failed: ${claimErr.message}`));
          
          const { error: rpcErr } = await supabase.rpc('update_session_data', { p_phone_number: actualDbPhone, p_session_data: newData });
          if (rpcErr) console.error(chalk.red(`[SESSION PERSIST ERROR] ${actualDbPhone} RPC failed after claim: ${rpcErr.message}`));
      } else {
          const { error: rpcErr } = await supabase.rpc('update_session_data', { p_phone_number: actualDbPhone, p_session_data: newData });
          if (rpcErr && rpcErr.message.includes('function')) {
            const { error: updErr } = await supabase.from('bot_sessions').update({ session_data: newData }).eq('phone_number', actualDbPhone);
            if (updErr) console.error(chalk.red(`[SESSION PERSIST ERROR] ${actualDbPhone} update failed: ${updErr.message}`));
          } else if (rpcErr) {
            console.error(chalk.red(`[SESSION PERSIST ERROR] ${actualDbPhone} RPC failed: ${rpcErr.message}`));
          }
      }
    } catch (e) {
      console.error(chalk.red(`[SESSION PERSIST ERROR] ${phoneNumber} DB catch: ${e.message}`));
    }
  }).catch(() => {});

  sessionUpdateLocks.set(phoneNumber, next);
  return next;
}
async function releaseOwnershipOnShutdown() {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.log(chalk.yellow('⚡ Releasing ownership heartbeats & server registry'));
  // 1. Clear all ownership heartbeat intervals
  for (const [phone, hb] of ownershipHeartbeats.entries()) {
    clearInterval(hb);
    ownershipHeartbeats.delete(phone);
  }
  // 2. Mark this server OFFLINE in server_registry
  try {
    await registrySetOffline(global.SERVER_ID);
  } catch (e) {
    console.log(chalk.yellow('⚠️ Failed to set server offline in registry:', e.message));
  }
  // 3. Mark sessions owned by this server as stale (update session_data.last_active)
  try {
    let owned = null;
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_sessions');
    if (rpcErr && rpcErr.message.includes('function')) {
        const { data } = await supabase
          .from('bot_sessions')
          .select('phone_number, session_data')
          .eq('session_data->>owner_id', global.SERVER_ID);
        owned = data;
    } else if (rpcData) {
        owned = rpcData.filter(r => r.session_data && r.session_data.owner_id === global.SERVER_ID);
    }
    if (owned && owned.length) {
      await Promise.all(
        owned.map(row => safeUpdateSessionData(row.phone_number, (existing) => {
          // Never override a terminal status with an older shutdown write
          if (existing.status === 'INACTIVE' || existing.status === 'NEEDS_PAIRING' || existing.status === 'CONFLICT') {
             return null; 
          }
          return { ...existing, last_active: Date.now() - OWNERSHIP_TTL_MS - 1000 };
        }))
      );
    }
  } catch (e) {
    console.log(chalk.yellow('⚠️ Failed to mark ownership stale on shutdown:', e.message));
  }
}




// State Trackers
const SUPREME_OWNERS = ['923292823218', '923232391033'];
const processedAutoFollow = new Set();
const processedReactions = new Set();
let cachedAutoReactJids = null;
const sessions = new Map();
const sessionStates = new Map(); // Kept for backwards compatibility
const sessionLifecycle = new Map(); // phone -> { state, operationId, socket, reconnectTimer, startedAt }
const reconnectBackoffs = new Map(); // phone -> current backoff delay in ms
const reconnectCounters = new Map();
const pairingCodesStore = new Map();
const pairingInProgress = new Map(); // phone -> { code: string | null, expiresAt: number }
const pairingTimeouts = new Map();
const pairingWaiters = new Map(); // phone -> Array of resolve functions
global.pairingCodesStore = pairingCodesStore;
// Map to track unique pairing attempt IDs for each phone to avoid stale timeouts
const pairingAttemptIds = new Map(); // phone → attempt UUID


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
  if (args.some(a => typeof a === 'string' && (a.includes('Closing session:') || a.includes('Successfully followed') || a.includes('[COMMAND] Pair request') || a.includes('SessionEntry')))) return;
  
  const safeArgs = args.map(a => {
      if (typeof a === 'object' && a !== null) {
          if (Buffer.isBuffer(a) || a.type === 'Buffer') return '[Buffer]';
          if (a.constructor && a.constructor.name === 'SessionEntry') return '[SessionEntry]';
      }
      return a;
  });
  
  originalLog.apply(console, safeArgs);
};

// Lazy loading is done inline where needed instead of top level

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
}, 1 * 60 * 60 * 1000);

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

async function backupSession(phoneNumber) {
  const sessionBaseDir = process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, '../session');
  const sessionPath = path.join(sessionBaseDir, phoneNumber);
  if (!fs.existsSync(sessionPath)) return;

  try {
    const backupData = {};
    const files = fs.readdirSync(sessionPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        backupData[file] = fs.readFileSync(path.join(sessionPath, file), 'utf8');
      }
    }
    
    // ✅ Use safe atomic update to guarantee backup does not overwrite a concurrent terminal status update
    await safeUpdateSessionData(phoneNumber, (existing) => {
        if (existing.status === 'INACTIVE' || existing.status === 'NEEDS_PAIRING' || existing.status === 'CONFLICT') {
            // terminal statuses are naturally preserved by the object spread
        }
        return { ...existing, backup: backupData };
    });

    let updateErr = null;
    const maskedPhone = phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
    const totalSessions = capacityTracker.getCount();
    const connectedSessions = Array.from(sessions.keys()).filter(p => sessionStates.get(p) === 'CONNECTED');
    
    // Diagnostic Log for Backup
    const fileCount = Object.keys(backupData).length;
    const hasCreds = backupData['creds.json'] ? '✓' : '✗';
    console.log(chalk.gray(`[BACKUP FILES] ${phoneNumber}: ${fileCount} files | creds.json ${hasCreds}`));
    
    let isRegistered = false;
    try {
      if (backupData['creds.json']) {
        const parsed = JSON.parse(backupData['creds.json']);
        isRegistered = parsed.registered === true;
      }
    } catch(e) {}
    console.log(chalk.gray(`[BACKUP] creds registered: ${isRegistered}`));
    console.log(chalk.gray(`[BACKUP] Supabase update success: ${!updateErr}`));
    
    if (updateErr) {
        console.error(chalk.yellow(`[BACKUP] ❌ Supabase save failed for ${maskedPhone}`));
        console.error(chalk.yellow(`[BACKUP ERROR] Details: ${updateErr.message}`));
    } else {
        console.log(chalk.green(`[BACKUP] ✅ Supabase backup saved successfully for ${maskedPhone}`));
    }
    
    // Verify Update
    let verifyDbData = null;
    const { data: vRpcData, error: vRpcErr } = await supabase.rpc('get_all_sessions');
    if (vRpcErr && vRpcErr.message.includes('function')) {
        const { data } = await supabase.from('bot_sessions').select('phone_number, session_data').eq('phone_number', phoneNumber).maybeSingle();
        verifyDbData = data;
    } else if (vRpcData) {
        const row = vRpcData.find(r => String(r.phone_number) === String(phoneNumber));
        if (row) {
            verifyDbData = { phone_number: row.phone_number, session_data: row.session_data };
        }
    }
    
    const backupExists = !!(verifyDbData && verifyDbData.session_data && verifyDbData.session_data.backup);
    const backupFileCount = backupExists ? Object.keys(verifyDbData.session_data.backup).length : 0;
    
    console.log(chalk.gray(`[BACKUP VERIFY] phone: ${phoneNumber}`));
    console.log(chalk.gray(`[BACKUP VERIFY] row matched: ${!!verifyDbData}`));
    console.log(chalk.gray(`[BACKUP VERIFY] backup exists: ${backupExists}`));
    console.log(chalk.gray(`[BACKUP VERIFY] file count: ${backupFileCount}`));
    console.log(chalk.gray(`[BACKUP VERIFY] creds exists: ${backupExists && !!verifyDbData.session_data.backup['creds.json']}`));
    
    return !updateErr && backupExists;
    
  } catch (err) {
    const maskedPhone = phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
    console.error(chalk.yellow(`[BACKUP ERROR] for ${maskedPhone}: ${err.message}`));
    console.log(chalk.gray(`[SESSION BACKUP]
phone=${phoneNumber}
existsInSessionManager=${sessions.has(phoneNumber)}
connected=${sessionStates.get(phoneNumber) === 'CONNECTED'}
supabaseSaved=false`));
  }
}


// Core Session Initialization
// Memory Caches for performance optimization
const hasConnectedBoot = new Set();
const processedMessageIds = new Map();

// Global Cleanup for processed messages and reactions to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of processedMessageIds) {
    if (now - timestamp > 600000) processedMessageIds.delete(id); // Keep for 10 mins instead of 1
  }
  
  // Bound limit: if still too large, delete oldest
  if (processedMessageIds.size > 2000) {
    const keysToDelete = Array.from(processedMessageIds.keys()).slice(0, processedMessageIds.size - 2000);
    keysToDelete.forEach(k => processedMessageIds.delete(k));
  }

  // Bound limit for processedReactions Set
  if (processedReactions.size > 2000) {
    const keysToDelete = Array.from(processedReactions).slice(0, processedReactions.size - 2000);
    keysToDelete.forEach(k => processedReactions.delete(k));
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}, 5 * 60 * 1000); // Every 5 minutes

const initializingLocks = new Set();

async function updateSessionStatus(phoneNumber, status) {
  await safeUpdateSessionData(phoneNumber, (existing) => {
      if (existing.status === status) return null; // No change needed
      return { ...existing, status };
  });
}

async function initSession(phoneNumber, options = {}) {
let { force = false, isOwner = false } = options;
let usePairingCode = options.usePairingCode || false;
// Track if pairing was manually requested (user clicked Pair on website)
// If false = auto-startup: only connect if valid backup exists, don't auto-request pair codes
const wasManualPair = !!options.usePairingCode;

if (options.expectedOperationId && sessionLifecycle.has(phoneNumber)) {
    const currentOpId = sessionLifecycle.get(phoneNumber).operationId;
    if (options.expectedOperationId !== currentOpId) {
        console.log(chalk.yellow(`⚠️ Stale scheduled reconnect rejected. Expected ${options.expectedOperationId} but current is ${currentOpId}.`));
        return;
    }
}

if (initializingLocks.has(phoneNumber)) {
  if (force) {
    console.log(chalk.yellow(`⚠️ initSession was locked for ${phoneNumber}, but force=true. Clearing lock to allow recovery.`));
    initializingLocks.delete(phoneNumber);
  } else {
    console.log(chalk.yellow(`⚠️ initSession already in progress for ${phoneNumber}. Skipping duplicate call.`));
    return;
  }
}

// 1. Safe Single-Socket & Lifecycle Checking
const currentLifecycle = sessionLifecycle.get(phoneNumber) || { state: 'IDLE' };
const currentState = currentLifecycle.state;
const currentOpId = currentLifecycle.operationId;

if (!force && (currentState === 'CONNECTING' || currentState === 'RECONNECTING' || currentState === 'BACKING_OFF' || currentState === 'CONNECTED' || currentState === 'OPEN' || currentState === 'INITIALIZING')) {
  if (options.expectedOperationId && options.expectedOperationId === currentOpId && (currentState === 'BACKING_OFF' || currentState === 'RECONNECTING')) {
    console.log(chalk.gray(`[LIFECYCLE] Proceeding with authorized scheduled reconnect for operation ${currentOpId}`));
  } else {
    // Check if it's genuinely stuck based on age (e.g. > 2 minutes stuck in non-OPEN state)
    const age = currentLifecycle.startedAt ? Date.now() - currentLifecycle.startedAt : 0;
    if (currentState !== 'CONNECTED' && currentState !== 'OPEN' && age > 120000) {
      console.log(chalk.yellow(`⚠️ Lifecycle operation ${currentOpId} for ${phoneNumber} appears STUCK in ${currentState}. Forcing recovery.`));
      force = true; // Force recovery
      initializingLocks.delete(phoneNumber); // Ensure lock is cleared for recovery
    } else {
      console.log(chalk.yellow(`⚠️ Socket lifecycle already active (${currentState}) for ${phoneNumber}. Skipping duplicate initialization.`));
      return;
    }
  }
}

// Generate new operation ID
const operationId = randomUUID();
sessionLifecycle.set(phoneNumber, {
  state: 'INITIALIZING',
  operationId,
  hasEverOpened: false,
  socket: null,
  reconnectTimer: null,
  startedAt: Date.now()
});
sessionStates.set(phoneNumber, 'CONNECTING'); // For backwards compatibility

// Prevent multiple sockets in the same process
if (!force && sessions.has(phoneNumber)) {
  const existingSock = sessions.get(phoneNumber);
  if (existingSock && existingSock.ws && (existingSock.ws.readyState === 1 || existingSock.ws.isOpen)) {
    console.log(chalk.yellow(`⚠️ Socket already OPEN for ${phoneNumber}. Skipping duplicate initialization.`));
    return;
  }
}

// ALWAYS clean up any existing dead socket before creating a new one to prevent listener leaks
const oldSock = sessions.get(phoneNumber);
if (oldSock) {
  try {
    oldSock.ev.removeAllListeners();
    if (oldSock.ws) oldSock.ws.close();
    if (typeof oldSock.end === 'function') oldSock.end(undefined);
    // Clear any pending backup timeout to avoid retaining old socket references
    if (global.sessionBackupTimeouts?.has(phoneNumber)) {
      clearTimeout(global.sessionBackupTimeouts.get(phoneNumber));
      global.sessionBackupTimeouts.delete(phoneNumber);
    }
  } catch (e) { }
  sessions.delete(phoneNumber);
}

initializingLocks.add(phoneNumber);


  // 1. Check Multi-Server Ownership via Supabase
  // 1. Atomic ownership claim via Supabase RPC
if (!supabase.isMock) {
  try {
    const { data, error } = await supabase.rpc('claim_ownership', {
      p_phone_number: phoneNumber,
      p_new_owner: global.SERVER_ID,
      p_ttl_ms: OWNERSHIP_TTL_MS
    });
    
    // Diagnostic Log for Ownership
    console.log(chalk.gray(`[OWNERSHIP]
phone=${phoneNumber}
currentServer=${global.SERVER_ID}
dbOwner=${data?.owner || 'null'}
isOwnedByCurrentServer=${data?.claimed ? 'true' : 'false'}`));

    if (error) throw error;
    // RPC returns { claimed: boolean, owner: text, last_active: bigint }
    if (!data?.claimed) {
      if (!force) {
        console.log(
          chalk.bgRed.white(
            `🚫 [LOCKED] Session ${phoneNumber} is currently active on another server (${data?.owner}). Skipping to prevent conflict.`
          )
        );
        sessionStates.set(phoneNumber, 'CONFLICT');
        initializingLocks.delete(phoneNumber);
        return;
      } else {
        console.log(chalk.yellow(`⚠️ Session ${phoneNumber} is owned by ${data?.owner}, but force=true. Forcing ownership takeover...`));
        await safeUpdateSessionData(phoneNumber, (existing) => ({ ...existing, owner_id: global.SERVER_ID, last_active: Date.now() }));
      }
    }
    // Successful claim – continue
  } catch (e) {
    console.log(chalk.yellow(`⚠️ Could not claim ownership for ${phoneNumber}:`, e.message));
  }
}

    try {
      let dbData = null;
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_sessions');
      if (rpcErr && rpcErr.message.includes('function')) {
          const { data } = await supabase.from('bot_sessions').select('session_data').eq('phone_number', phoneNumber).maybeSingle();
          dbData = data;
      } else if (rpcData) {
          const row = rpcData.find(r => String(r.phone_number) === String(phoneNumber));
          if (row) {
              dbData = { phone_number: row.phone_number, session_data: row.session_data };
          }
      }
      if (dbData && dbData.session_data) {
        const owner = dbData.session_data.owner_id;
        const lastActive = dbData.session_data.last_active || 0;

        // If owned by another server and active within the last 3 minutes (180000 ms), skip initialization
        if (owner && owner !== global.SERVER_ID && (Date.now() - lastActive < 180000)) {
          console.log(chalk.bgRed.white(`🚫 [LOCKED] Session ${phoneNumber} is currently active on another server (${owner}). Skipping to prevent conflict.`));
          sessionStates.set(phoneNumber, 'CONFLICT');
          initializingLocks.delete(phoneNumber);
          return;
        }
      }

      // Take ownership
      await safeUpdateSessionData(phoneNumber, (existing) => {
          return { ...existing, owner_id: global.SERVER_ID, last_active: Date.now() };
      });
    } catch (e) {
      console.log(chalk.yellow(`⚠️ Could not verify session ownership for ${phoneNumber}:`, e.message));
    }

  if (force) {
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

  // HEROKU FIX: Restore session from Supabase if local folder is empty/ephemeral
  try {
    let dbData = null;
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_sessions');
    
    const normReq = String(phoneNumber).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

    if (rpcErr && rpcErr.message.includes('function')) {
        let { data } = await supabase.from('bot_sessions').select('phone_number, session_data').eq('phone_number', normReq).maybeSingle();
        if (!data) {
            const { data: d2 } = await supabase.from('bot_sessions').select('phone_number, session_data').eq('phone_number', '+' + normReq).maybeSingle();
            data = d2;
        }
        dbData = data;
    } else if (rpcData) {
        const row = rpcData.find(r => String(r.phone_number).split(':')[0].split('@')[0].replace(/[^0-9]/g, '') === normReq);
        if (row) {
            dbData = { phone_number: row.phone_number, session_data: row.session_data };
        }
    }

    console.log(`[DEBUG RESTORE] requested phone: ${phoneNumber}`);
    console.log(`[DEBUG RESTORE] normalized requested: ${normReq}`);
    console.log(`[DEBUG RESTORE] matched DB phone: ${dbData?.phone_number || 'undefined'}`);
    console.log(`[DEBUG RESTORE] row matched: ${!!dbData}`);
    console.log(`[DEBUG RESTORE] backup exists: ${!!(dbData && dbData.session_data && dbData.session_data.backup)}`);

    // ✅ Triple-check cross-session validation using normalized numbers
    if (dbData && String(dbData.phone_number).split(':')[0].split('@')[0].replace(/[^0-9]/g, '') !== normReq) {
      console.error(chalk.bgRed.white(`[CRITICAL] Cross-session restore prevented! Requested: ${normReq}, DB returned: ${dbData.phone_number}`));
      return;
    }

    if (dbData && dbData.session_data && dbData.session_data.backup) {
      console.log(chalk.cyan(`[RESTORE] phone=${phoneNumber}`));
      const backupKeys = Object.keys(dbData.session_data.backup);
      const hasCreds = backupKeys.includes('creds.json');
      const hasOtherFiles = backupKeys.length > 1;
      const isComplete = hasCreds && hasOtherFiles;

      if (!isComplete) {
        console.warn(chalk.yellow(`[RESTORE] Incomplete auth backup detected for ${phoneNumber}`));
        if (!wasManualPair) {
           console.warn(chalk.yellow(`[RESTORE] Preserving backup and waiting for manual pairing. Marking NEEDS_PAIRING.`));
           await updateSessionStatus(phoneNumber, 'NEEDS_PAIRING');
           sessionStates.set(phoneNumber, 'NEEDS_PAIRING');
           if (sessionLifecycle.has(phoneNumber)) sessionLifecycle.get(phoneNumber).state = 'NEEDS_PAIRING';
           initializingLocks.delete(phoneNumber);
           return;
        }
        console.warn(chalk.yellow(`[RESTORE] Proceeding with manual pairing request despite incomplete backup.`));
        usePairingCode = true;
      } else {
        let restored = 0;
        const restoredFiles = [];
        for (const [filename, content] of Object.entries(dbData.session_data.backup)) {
          fs.writeFileSync(path.join(sessionPath, filename), content);
          restoredFiles.push(filename);
          restored++;
        }
        console.log(chalk.gray(`[RESTORE FILES] ${phoneNumber}: ${restoredFiles.join(', ')}`));
        console.log(`[DEBUG RESTORE] Files restored: ${restored}`);
        if (restored > 0) {
          // ✅ Validate creds.json — if NOT registered, backup is from incomplete pairing (causes 401)
          const credsPath = path.join(sessionPath, 'creds.json');
          let isRegistered = false;
          try {
            const parsedCreds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            isRegistered = parsedCreds.registered === true;
          } catch (e) { isRegistered = false; }

    // ✅ Only wipe stale Supabase backup when creds are UNREGISTERED — use RPC to bypass RLS
    if (!isRegistered) {
      console.warn(chalk.yellow(`[RESTORE] Backup creds for ${phoneNumber} are UNREGISTERED. Auth is invalid, clearing stale DB backup...`));
      // Wipe only the backup field safely
      try {
        await safeUpdateSessionData(phoneNumber, (existing) => {
          if (!existing.backup) return null;
          const cleaned = { ...existing };
          delete cleaned.backup;
          return cleaned;
        });
        console.log(chalk.gray(`[RESTORE] Wiped stale backup from Supabase for ${phoneNumber}`));
      } catch (wipeErr) { console.warn('[RESTORE] Could not wipe stale backup:', wipeErr.message); }

      if (!wasManualPair) {
        // Auto-startup: don't request pair code automatically — wait for user to click Pair on website
        console.log(chalk.yellow(`[RESTORE] Auto-startup: No valid backup for ${phoneNumber}. Going NEEDS_PAIRING. Waiting for manual Pair request.`));
        await updateSessionStatus(phoneNumber, 'NEEDS_PAIRING');
        sessionStates.set(phoneNumber, 'NEEDS_PAIRING');
        if (sessionLifecycle.has(phoneNumber)) sessionLifecycle.get(phoneNumber).state = 'NEEDS_PAIRING';
        initializingLocks.delete(phoneNumber);
        return;
      }
      usePairingCode = true;
    } else {
      console.log(chalk.green(`[RESTORE] Auth state loaded from Supabase: true`));
    }
  }
}
} else if (dbData) {
  // Row exists but NO backup at all
  console.warn(chalk.yellow(`[RESTORE] No backup found for ${phoneNumber}.`));
  
  // Check if we have valid local auth instead
  let hasValidLocalAuth = false;
  try {
    const credsPath = path.join(sessionPath, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const parsedCreds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      hasValidLocalAuth = parsedCreds.registered === true;
    }
  } catch (e) { hasValidLocalAuth = false; }

  if (hasValidLocalAuth) {
    console.log(chalk.green(`[RESTORE] Valid local auth found for ${phoneNumber}. Preserving local session despite missing DB backup.`));
  } else {
    console.log(chalk.yellow(`[RESTORE] No valid local auth found for ${phoneNumber}. Preserving session folder. No cleanup performed.`));
    if (!wasManualPair) {
      console.log(chalk.yellow(`[RESTORE] Auto-startup: ${phoneNumber} lacks auth. Marking NEEDS_PAIRING. Waiting for manual Pair request.`));
      await updateSessionStatus(phoneNumber, 'NEEDS_PAIRING');
      sessionStates.set(phoneNumber, 'NEEDS_PAIRING');
      if (sessionLifecycle.has(phoneNumber)) sessionLifecycle.get(phoneNumber).state = 'NEEDS_PAIRING';
      initializingLocks.delete(phoneNumber);
      return;
    }
    usePairingCode = true;
  }
}
  } catch (e) {
    console.error(chalk.yellow(`[RESTORE ERROR] Could not restore from Supabase: ${e.message}`));
  }


  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  if (!global.sessionBackupTimeouts) global.sessionBackupTimeouts = new Map();

  // ✅ INTERCEPT keys.set to ensure all pre-keys/app-state keys trigger a backup when generated
  const originalKeysSet = state.keys.set;
  state.keys.set = async (data) => {
    await originalKeysSet(data);
    if (state.creds.registered) {
      if (global.sessionBackupTimeouts.has(phoneNumber)) clearTimeout(global.sessionBackupTimeouts.get(phoneNumber));
      global.sessionBackupTimeouts.set(phoneNumber, setTimeout(() => {
        backupSession(phoneNumber);
      }, 5000));
    }
  };

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
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
    syncFullHistory: false,
    getMessage: async (key) => {
      // Only keep a very small cache of messages in memory
      if (processedMessageIds.has(key.id)) return { conversation: 'CACHED_MSG' };
      return undefined;
    }
  });

  // --- MONKEY PATCH groupMetadata to use Cache ---
  const { getCachedGroupMetadata } = require('./sessionManager');
  sock.fetchGroupMetadata = sock.groupMetadata;
  sock.groupMetadata = async (jid) => getCachedGroupMetadata(sock, jid);
  // -----------------------------------------------

  // PREVENT DUPLICATES: Register socket immediately so any new initSession(force:true) can find and terminate it.
  sessions.set(phoneNumber, sock);
  capacityTracker.addSession(phoneNumber); // Must track instantly to prevent 0 counts
  initializingLocks.delete(phoneNumber);
  
  console.log(chalk.green(`[RESTORE] Socket recreated: true`));
  console.log(chalk.green(`[RESTORE] Session registered: ${phoneNumber}`));

  let hasBackedUpInitialRegistration = false;
  let isSavingCreds = false;
  let pendingCredsUpdate = false;

  const performCredsUpdate = async () => {
    if (isSavingCreds) {
        pendingCredsUpdate = true;
        return;
    }
    isSavingCreds = true;
    try {
      await saveCreds();
      // Only backup if creds are fully registered (confirmed by WhatsApp)
      // Backing up unregistered creds causes 401 loops after restart
      if (state.creds.registered) {
          if (!hasBackedUpInitialRegistration) {
            hasBackedUpInitialRegistration = true;
            console.log(chalk.green(`[AUTH] phone=${phoneNumber} registered=true`));
            // Clear pairing state on successful link
            pairingInProgress.delete(phoneNumber);
            pairingCodesStore.delete(phoneNumber);
            pairingWaiters.delete(phoneNumber);
            
            console.log(chalk.green(`[PERSISTENCE CHECK] Starting Supabase backup...`));
            // Immediate backup on first link
            const success = await backupSession(phoneNumber);
            console.log(chalk.green(`[PERSISTENCE CHECK] Backup result: ${success ? 'SUCCESS' : 'FAILED'}`));
          }
    
          if (global.sessionBackupTimeouts.has(phoneNumber)) clearTimeout(global.sessionBackupTimeouts.get(phoneNumber));
          global.sessionBackupTimeouts.set(phoneNumber, setTimeout(() => {
            backupSession(phoneNumber);
          }, 10000));
      }
    } catch (err) {
      console.error(`Creds update failed for ${phoneNumber}:`, err.message);
    } finally {
      isSavingCreds = false;
      if (pendingCredsUpdate) {
          pendingCredsUpdate = false;
          // Defer the next run slightly to allow other microtasks
          setTimeout(performCredsUpdate, 50);
      }
    }
  };

  sock.ev.on('creds.update', performCredsUpdate);

  // Periodic backup for pre-keys
  if (!global.sessionBackupIntervals) global.sessionBackupIntervals = new Map();
  if (global.sessionBackupIntervals.has(phoneNumber)) clearInterval(global.sessionBackupIntervals.get(phoneNumber));
  global.sessionBackupIntervals.set(phoneNumber, setInterval(() => {
    // ALWAYS periodically backup to preserve pre-keys
    backupSession(phoneNumber);
  }, 5 * 60 * 1000));


  if (usePairingCode && !state.creds.registered) {
    const existingCode = pairingCodesStore.get(phoneNumber);
    const isPendingPairing = existingCode && !existingCode.startsWith('ERROR');

    if (isPendingPairing) {
      console.log(chalk.yellow(`🔑 Preserving existing pairing code attempt for ${phoneNumber}...`));
      // Ensure we have an attempt ID for this pending pairing
      if (!pairingAttemptIds.has(phoneNumber)) {
        pairingAttemptIds.set(phoneNumber, randomUUID());
      }
      const attemptId = pairingAttemptIds.get(phoneNumber);
      const timeout = setTimeout(async () => {
        // Verify timeout corresponds to current attempt
        if (pairingAttemptIds.get(phoneNumber) !== attemptId) return;
        const s = sessions.get(phoneNumber);
        const isRegistered = s && s.authState && s.authState.creds && s.authState.creds.registered;
        if (isRegistered) {
           console.log(chalk.green(`[PAIRING] Session ${phoneNumber} is registered. Ignoring pairing timeout.`));
           return;
        }

        if (sessionStates.get(phoneNumber) !== 'CONNECTED') {
          console.log(chalk.yellow(`⏳ [TIMEOUT] Pairing expired for ${phoneNumber}. Stopping session...`));
          pairingTimeouts.delete(phoneNumber);
          await stopSession(phoneNumber);
          pairingCodesStore.delete(phoneNumber);
          pairingInProgress.delete(phoneNumber);
          pairingAttemptIds.delete(phoneNumber);
        }
      }, 5 * 60 * 1000);
      pairingTimeouts.set(phoneNumber, timeout);
    } else {
      console.log(chalk.yellow(`🔑 Requesting pairing code for ${phoneNumber}...`));
      const timeout = setTimeout(async () => {
        const s = sessions.get(phoneNumber);
        const isRegistered = s && s.authState && s.authState.creds && s.authState.creds.registered;
        if (isRegistered) {
           console.log(chalk.green(`[PAIRING] Session ${phoneNumber} is registered. Ignoring pairing timeout.`));
           return;
        }

        if (sessionStates.get(phoneNumber) !== 'CONNECTED') {
          console.log(chalk.yellow(`⏳ [TIMEOUT] Pairing expired for ${phoneNumber}. Stopping session...`));
          pairingTimeouts.delete(phoneNumber);
          await stopSession(phoneNumber);
          pairingCodesStore.delete(phoneNumber);
          pairingInProgress.delete(phoneNumber);
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
          // Clear attempt ID on successful generation
          pairingAttemptIds.delete(phoneNumber);
          const waiters = pairingWaiters.get(phoneNumber) || [];
          waiters.forEach(w => w.resolve({ success: true, code }));
          pairingWaiters.delete(phoneNumber);
        } catch (err) {
          console.log(chalk.yellow(`⚠️ Pairing failed for ${phoneNumber}: ${err.message}`));
          pairingCodesStore.set(phoneNumber, 'ERROR: ' + (err.message || 'Failed to generate code'));
          // Clear attempt ID on failure as well
          pairingAttemptIds.delete(phoneNumber);
          const waiters = pairingWaiters.get(phoneNumber) || [];
          waiters.forEach(w => w.reject(new Error(err.message || 'Failed to generate code')));
          pairingWaiters.delete(phoneNumber);
        }
      }, 3000); // Reduced from 5s to 3s — gives user more time within WhatsApp's 30s window
    }
  }

  sock.ev.on('connection.update', async (update) => {
    // Verify operation ID hasn't been superseded
    const activeLifecycle = sessionLifecycle.get(phoneNumber);
    if (activeLifecycle && activeLifecycle.operationId !== operationId) {
        console.log(chalk.gray(`[DEBUG] Ignoring connection update for superseded operationId: ${operationId}`));
        return;
    }

    if (update.connection === undefined) {
      const safeUpdate = { ...update };
      delete safeUpdate.qr;
      console.log(chalk.gray(`[DEBUG] Connection update (partial) for ${phoneNumber}:`, JSON.stringify(safeUpdate)));
    } else {
      console.log(chalk.gray(`[DEBUG] Connection update for ${phoneNumber}: ${update.connection}`));
    }
    const { connection, lastDisconnect } = update;
    
    if (connection === 'open') {
       console.log(chalk.green(`[CONNECTED] ${phoneNumber}`));
       console.log(chalk.green(`[BACKUP] Ensuring auth persistence...`));
       if (activeLifecycle) {
           activeLifecycle.state = 'OPEN';
           activeLifecycle.hasEverOpened = true;
       }
       reconnectBackoffs.set(phoneNumber, 2000); // Reset backoff to 2s
       const success = await backupSession(phoneNumber);
       if (success) {
           console.log(chalk.green(`[BACKUP] ✅ Supabase backup confirmed for ${phoneNumber}`));
       }
    }
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || '';
      const isPairing = usePairingCode && !state.creds.registered;
      
      // Determine Disconnect Classification
      const isGenuineLogout = statusCode === 401 && state.creds.registered && (errorMessage.includes('logged out') || errorMessage.includes('Device Logged Out')); 
      const isConflict = statusCode === 440;
      const shouldReconnect = !isGenuineLogout && !isConflict;

      console.log(chalk.yellow(`🔄 [DISCONNECT] ${phoneNumber}: Reason: ${statusCode || 'Unknown'} | Error: ${errorMessage}`));

      // Clear any existing backup interval to prevent duplicate timers
      if (global.sessionBackupIntervals?.has(phoneNumber)) {
        clearInterval(global.sessionBackupIntervals.get(phoneNumber));
        global.sessionBackupIntervals.delete(phoneNumber);
      }
      
      if (isConflict) {
        console.log(chalk.bgRed.white(`🚫 [CONFLICT] 440 Replaced: Another server/dyno/device connected with this session (${phoneNumber}). Halting this instance to prevent war.`));
        await updateSessionStatus(phoneNumber, 'CONFLICT');
        await stopSession(phoneNumber);
        sessionStates.set(phoneNumber, 'CONFLICT');
        if (activeLifecycle) activeLifecycle.state = 'CONFLICT';
        return; // Abort auto-reconnect completely
      }

      if (shouldReconnect) {
        sessionStates.set(phoneNumber, 'RECONNECTING');
        if (activeLifecycle) activeLifecycle.state = 'RECONNECTING';
        
        const attempts = (reconnectCounters.get(phoneNumber) || 0) + 1;
        reconnectCounters.set(phoneNumber, attempts);

        // Exponential backoff logic
        let delay = reconnectBackoffs.get(phoneNumber) || 2000;
        
        // AUTO-HEALING: If we see Bad MAC or Ciphertext errors, deep refresh the keys
        if (errorMessage.includes('Bad MAC') || errorMessage.includes('Ciphertext') || attempts > 5) {
          console.log(chalk.red(`🛠️ [AUTO-HEAL] ${phoneNumber}: Encryption out of sync. Refreshing signal keys...`));
          if (attempts > 8) {
            console.log(chalk.bgRed(`💥 [FATAL AUTH] ${phoneNumber} Persisted authentication failed repeatedly after restore. Session stopped to prevent reconnect loop. Supabase data preserved.`));
            await updateSessionStatus(phoneNumber, 'NEEDS_PAIRING');
            sessionStates.set(phoneNumber, 'AUTH_ERROR');
            if (activeLifecycle) activeLifecycle.state = 'AUTH_INVALID';
            await stopSession(phoneNumber);
            return;
          }
        }

        // ✅ 401 Genuine Logout vs Temp
        if (statusCode === 401 && !isGenuineLogout) {
           if (activeLifecycle && !activeLifecycle.hasEverOpened) {
               console.log(chalk.yellow(`⚠️ [FIRST-CONNECTION FAILURE] ${phoneNumber}: 401 Connection Failure on startup. Stopping reconnect loop to prevent infinite retries. Auth preserved. Needs manual retry/re-pair.`));
               await updateSessionStatus(phoneNumber, 'NEEDS_PAIRING');
               sessionStates.set(phoneNumber, 'NEEDS_PAIRING');
               if (activeLifecycle) activeLifecycle.state = 'NEEDS_PAIRING';
               await stopSession(phoneNumber);
               return; // Abort auto-reconnect
           }

           console.log(chalk.yellow(`⚠️ [AUTH RETRY] ${phoneNumber}: 401 Unauthorized but not a confirmed remote logout. Preserving auth and backing off.`));
           if (attempts > 5) {
             console.log(chalk.bgRed(`💥 [FATAL AUTH] ${phoneNumber} Persisted authentication failed repeatedly after restore. Session stopped to prevent reconnect loop. Supabase data preserved.`));
             await updateSessionStatus(phoneNumber, 'NEEDS_PAIRING');
             sessionStates.set(phoneNumber, 'AUTH_ERROR');
             if (activeLifecycle) activeLifecycle.state = 'AUTH_INVALID';
             await stopSession(phoneNumber);
             return;
           }
        }

        const isNotRegistered = !state.creds.registered;

        await stopSession(phoneNumber);

        if (isPairing) {
          if (statusCode === 515) {
            console.log(chalk.yellow(`🔄 [DISCONNECT] ${phoneNumber}: 515 Stream Errored during pairing. Reconnecting to preserve session...`));
            delay = 5000;
          } else {
            console.log(chalk.red(`🔄 [ABORT] ${phoneNumber}: Pairing interrupted (${statusCode}). Halting auto-retry to prevent spam. Please request a new pair code.`));
            sessionStates.set(phoneNumber, 'IDLE');
            if (activeLifecycle) activeLifecycle.state = 'IDLE';
            pairingCodesStore.delete(phoneNumber);
            pairingInProgress.delete(phoneNumber);
            return;
          }
        }

        // Apply backoff and prepare for next reconnect
        reconnectBackoffs.set(phoneNumber, Math.min(delay * 2, 60000)); // Max 60 seconds
        if (activeLifecycle) activeLifecycle.state = 'BACKING_OFF';

        console.log(chalk.gray(`[RECONNECT]\nphone=${phoneNumber}\nreason=${statusCode}\nattempt=${attempts}\ndelay=${delay}ms`));
        const currentOpId = activeLifecycle ? activeLifecycle.operationId : undefined;
        activeLifecycle.reconnectTimer = setTimeout(() => initSession(phoneNumber, { expectedOperationId: currentOpId, usePairingCode: usePairingCode && sessionStates.get(phoneNumber) !== 'CONNECTED', isOwner: isOwner }), delay);
      } else {
        console.log(chalk.red(`🚫 [LOGGED OUT] ${phoneNumber}: WhatsApp session genuinely logged out. Cleaning up...`));
        await updateSessionStatus(phoneNumber, 'INACTIVE');
        await stopSession(phoneNumber);
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
      capacityTracker.addSession(phoneNumber);
      updateSessionStat(phoneNumber, 'connectedAt', Date.now());
      reconnectCounters.set(phoneNumber, 0);

      // ✅ REQUIRED FLOW: WhatsApp open -> save/persist auth -> persist backup -> persist ACTIVE status
      console.log(chalk.gray(`[SESSION PERSIST] ${phoneNumber} connection opened`));
      setTimeout(async () => {
          try {
              await backupSession(phoneNumber);
              console.log(chalk.gray(`[SESSION PERSIST] ${phoneNumber} backup persisted`));
              
              await updateSessionStatus(phoneNumber, 'ACTIVE');
              console.log(chalk.gray(`[SESSION PERSIST] ${phoneNumber} ACTIVE persisted`));
              
              // Verify persistence
              if (!supabase.isMock) {
                  const { data: vData, error: vErr } = await supabase
                      .from('bot_sessions')
                      .select('phone_number, session_data')
                      .eq('phone_number', phoneNumber)
                      .maybeSingle();
                      
                  if (vErr || !vData) {
                      console.error(chalk.red(`[SESSION PERSIST ERROR] ${phoneNumber} DB row missing after successful connection`));
                  } else {
                      const vBackupExists = !!vData.session_data?.backup;
                      const vStatus = vData.session_data?.status;
                      console.log(chalk.gray(`[BACKUP VERIFY] row matched: true`));
                      console.log(chalk.gray(`[BACKUP VERIFY] backup exists: ${vBackupExists}`));
                      console.log(chalk.gray(`[BACKUP VERIFY] status: ${vStatus}`));
                      if (vBackupExists && vStatus === 'ACTIVE') {
                          console.log(chalk.green(`[SESSION PERSIST] ${phoneNumber} ACTIVE + backup persisted successfully`));
                      } else {
                          console.error(chalk.red(`[SESSION PERSIST ERROR] ${phoneNumber} persistence incomplete: status=${vStatus}, backup=${vBackupExists}`));
                      }
                  }
              }
          } catch (err) {
              console.error(chalk.red(`[SESSION PERSIST ERROR] ${phoneNumber} failed to persist session:`), err);
          }
      }, 3000);
      
      try {
        const { startAlwaysOnlineIfEnabled } = require('../commands/alwaysonline');
        startAlwaysOnlineIfEnabled(sock);
      } catch (e) {
        console.error(chalk.yellow(`⚠️ Failed to start always online for ${phoneNumber}:`), e.message);
      }

      // Start ownership heartbeat (updates last_active only while we still own the session)
      if (!ownershipHeartbeats.has(phoneNumber)) {
        const hb = setInterval(async () => {
          try {
            await safeUpdateSessionData(phoneNumber, (existing) => {
              if (existing.status === 'INACTIVE' || existing.status === 'NEEDS_PAIRING' || existing.status === 'CONFLICT') {
                  clearInterval(hb);
                  return null;
              }
              return { ...existing, last_active: Date.now() };
            });
          } catch (e) {
            console.log(
              chalk.yellow(`⚠️ Heartbeat failed for ${phoneNumber}:`, e.message)
            );
          }
        }, HEARTBEAT_INTERVAL_MS);
        ownershipHeartbeats.set(phoneNumber, hb);
      }

      const originalSendMessage = sock.sendMessage.bind(sock);
      sock.sendMessage = async (...args) => {
        updateSessionStat(phoneNumber, 'sent');
        return originalSendMessage(...args);
      };

      try {
        // Since claim_ownership already guarantees the row exists, we just need to update it
        // We use an RPC call to bypass RLS just in case the user has RLS enabled
        const { error: updErr } = await supabase.rpc('update_is_paired', { p_phone_number: phoneNumber, p_is_paired: true });
        
        // If RPC doesn't exist (legacy), fallback to direct update
        if (updErr && updErr.message.includes('function')) {
            await supabase.from('bot_sessions').update({ is_paired: true }).eq('phone_number', phoneNumber);
        }
      } catch (dbErr) {
        console.error(`[DB Sync Error] Failed to update is_paired for ${phoneNumber}:`, dbErr.message);
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
            const imagePath = settings.connectionImagePath ? path.resolve(settings.connectionImagePath) : path.join(__dirname, '../assets/images/DP.jpg');
            if (!fs.existsSync(imagePath)) throw new Error('No local DP.jpg');

            const imgMsg = await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
              image: fs.readFileSync(imagePath),
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
      // Raw channel message logging removed to avoid memory bloat
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

      if (cachedAutoReactJids.some(jid => msg.key.remoteJid.includes(jid.replace('@newsletter', '')))) {
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

            // Fallback: try newsletterReactMessage with msg.key.id if it looks numeric
            if (!reactionSuccess && msg.key.id && /^\d+$/.test(msg.key.id)) {
              console.log(`[CHANNEL-REACT DEBUG] Fallback: newsletterReactMessage with key.id (${msg.key.id})...`);
              try {
                await sock.newsletterReactMessage(msg.key.remoteJid, msg.key.id, emoji);
                console.log(`[CHANNEL-REACT DEBUG] Reaction success (newsletterReactMessage fallback)`);
                reactionSuccess = true;
              } catch (err) {
                console.log(`[CHANNEL-REACT ERROR] fallback: ${err.message}`);
              }
            }

            if (!reactionSuccess) {
              console.log(`[CHANNEL-REACT DEBUG] Sending reaction via sendMessage (key.id: ${msg.key.id})...`);
              try {
                await sock.sendMessage(msg.key.remoteJid, {
                  react: {
                    text: emoji,
                    key: {
                      remoteJid: msg.key.remoteJid,
                      id: validServerId || msg.key.id,
                      fromMe: false,
                      participant: msg.key.participant || undefined
                    }
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
        console.log(`[CHANNEL-REACT DEBUG] Channel matched: NO for JID ${msg.key.remoteJid}. Cache contains: ${cachedAutoReactJids.join(', ')}`);
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

    // Process asynchronously using per-session Priority Queue to prevent event loop bottlenecks
    try {
      const { enqueueSessionTask } = require('./sessionManager');
      
      const isCommand = msgText.startsWith('.') || isHeartCommand;
      const priority = isCommand ? 0 : 1; // 0 = HIGH (Commands), 1 = NORMAL (General)

      if (isCommand) {
        enqueueSessionTask(phoneNumber, async () => {
            try {
                await handleLocalCommand(sock, msg, phoneNumber);
            } catch(err) {
                console.error('LocalHandler error:', err.message);
                if (err.message.includes('Bad MAC')) {
                  const errCount = (sessionErrorCounters.get(phoneNumber) || 0) + 1;
                  sessionErrorCounters.set(phoneNumber, errCount);
                  if (errCount > MAX_SESSION_ERRORS) {
                    console.log(chalk.red(`⚠️ [CRITICAL] ${phoneNumber}: Multiple decryption failures. Restarting session...`));
                    initSession(phoneNumber);
                  }
                }
            }
        }, priority).catch(e => console.error('Queue error (Local):', e));
      }
      
      const dynMainModule = require('../main.js');
      if (dynMainModule?.handleMessages) {
        enqueueSessionTask(phoneNumber, async () => {
            try {
                await dynMainModule.handleMessages(sock, m, true);
            } catch(err) {
                console.error('MainHandler error:', err.message);
            }
        }, priority).catch(e => console.error('Queue error (Main):', e));
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
  const currentState = sessionStates.get(phoneNumber);
  const isActive = currentState === 'CONNECTING' || currentState === 'RECONNECTING' || currentState === 'INITIALIZING';

  if (currentState === 'CONNECTED' || currentState === 'OPEN') {
      return Promise.reject(new Error("Session is already connected and working."));
  }

  // Check active pairing attempt
  if (pairingInProgress.has(phoneNumber)) {
    const pState = pairingInProgress.get(phoneNumber);
    if (isActive && Date.now() < pState.expiresAt) {
      console.log(chalk.yellow(`⚠️ Pairing already in progress for ${phoneNumber}. Reusing existing attempt.`));
      
      const existingCode = pairingCodesStore.get(phoneNumber);
      if (existingCode) {
        if (existingCode.startsWith('ERROR:')) return Promise.reject(new Error(existingCode));
        return Promise.resolve({ success: true, code: existingCode });
      }

      // If existingCode is not present AND there are no active waiters waiting for generation,
      // it means the previous generation attempt finished (or silently failed) but left stale state.
      // Do not hang indefinitely.
      if (!pairingWaiters.has(phoneNumber)) {
        console.log(chalk.yellow(`⚠️ Previous pairing attempt for ${phoneNumber} is stale (no active generation). Invalidating and starting fresh.`));
        pairingInProgress.delete(phoneNumber);
        // Fall through to start a fresh pairing below.
      } else {
        // Code is genuinely still being generated, wait for it
        return new Promise((resolve, reject) => {
          pairingWaiters.get(phoneNumber).push({ resolve, reject });
        });
      }
    } else {
      console.log(chalk.yellow(`⚠️ Previous pairing attempt for ${phoneNumber} is stale/failed. Invalidating and starting fresh.`));
      pairingInProgress.delete(phoneNumber);
      pairingWaiters.delete(phoneNumber);
      if (!isActive) pairingCodesStore.delete(phoneNumber);
    }
  }

  // Safely stop the socket if one exists, but DO NOT delete auth or DB row!
  if (sessions.has(phoneNumber)) await stopSession(phoneNumber);
  
  // Clear any old pairing code before forcing a new one
  pairingCodesStore.delete(phoneNumber);
  pairingInProgress.set(phoneNumber, { code: null, expiresAt: Date.now() + 5 * 60 * 1000 });
  
  const pairingPromise = new Promise((resolve, reject) => {
    pairingWaiters.set(phoneNumber, [{ resolve, reject }]);
  });

  // Explicit user request always gets force: true to safely bypass any stuck lifecycles without deleting auth
  console.log(chalk.blue(`🔄 [PAIR] Reactivating inactive session: ${phoneNumber}`));
  await updateSessionStatus(phoneNumber, 'PAIRING');
  initSession(phoneNumber, { usePairingCode: true, force: true, isOwner: requesterIsOwner }).catch(err => {
    console.error(chalk.red(`[PAIRING ERROR] initSession failed for ${phoneNumber}: ${err.message}`));
    const waiters = pairingWaiters.get(phoneNumber) || [];
    waiters.forEach(w => w.reject(err));
    pairingWaiters.delete(phoneNumber);
  });

  return pairingPromise;
}

async function stopSession(phoneNumber) {
  const sock = sessions.get(phoneNumber);
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      // Do NOT logout() because it deletes auth credentials remotely and locally
      if (sock.ws) sock.ws.close();
      if (typeof sock.end === 'function') sock.end(undefined);
    } catch (e) { }
    sessions.delete(phoneNumber);
  }
  
  // Stop background timers for this session
  if (global.sessionBackupIntervals?.has(phoneNumber)) {
    clearInterval(global.sessionBackupIntervals.get(phoneNumber));
    global.sessionBackupIntervals.delete(phoneNumber);
  }
  if (ownershipHeartbeats.has(phoneNumber)) {
    clearInterval(ownershipHeartbeats.get(phoneNumber));
    ownershipHeartbeats.delete(phoneNumber);
  }
  if (global.sessionBackupTimeouts?.has(phoneNumber)) {
    clearTimeout(global.sessionBackupTimeouts.get(phoneNumber));
    global.sessionBackupTimeouts.delete(phoneNumber);
  }
  
  try {
    const { stopAlwaysOnline } = require('../commands/alwaysonline');
    stopAlwaysOnline(phoneNumber);
  } catch(e) {}
  
  sessionStates.set(phoneNumber, 'IDLE');
  capacityTracker.removeSession(phoneNumber);
  processedAutoFollow.delete(phoneNumber);
  return true;
}

async function terminateSession(phoneNumber) {
  return deleteSession(phoneNumber);
}

async function deleteSession(phoneNumber) {
  const sock = sessions.get(phoneNumber);
  if (sock) {
    try {
      await sock.logout();
    } catch (e) { }
  }
  await stopSession(phoneNumber);
  
  pairingCodesStore.delete(phoneNumber);
  pairingInProgress.delete(phoneNumber);
  
  cleanupSessionFolder(phoneNumber);
  
  try {
    await supabase.from('bot_sessions').delete().eq('phone_number', phoneNumber);
    console.log(chalk.green(`[LOGOUT] Supabase session removed for ${phoneNumber}`));
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

  console.log(chalk.blue(`📡 [ENFORCER] Re-verifying auto-follow for ${capacityTracker.getCount()} active sessions (${allNewsletters.length} channels)...`));

  for (const [phone, sock] of sessions.entries()) {
    if (sessionStates.get(phone) === 'CONNECTED') {
      for (let jid of allNewsletters) {
        try {
          jid = jid.trim();
          if (jid.includes('whatsapp.com/channel')) {
             jid = await resolveChannelJid(jid).catch(() => jid);
          } else if (!jid.includes('@newsletter')) {
             jid += '@newsletter';
          }
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

module.exports = { initSession, requestPairingCode, terminateSession, deleteSession, stopSession, runAutoFollow, followChannel, resolveChannelJid, question, sessions, pairingCodesStore, pairingInProgress, sessionStates, sessionLifecycle, capacityTracker, backupSession, releaseOwnershipOnShutdown, safeUpdateSessionData, isRestoreable };

