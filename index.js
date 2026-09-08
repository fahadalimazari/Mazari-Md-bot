require('dotenv').config();
const crypto = require('crypto');
global.SERVER_ID = process.env.SERVER_ID || process.env.DYNO || ('local-' + process.pid + '-' + crypto.randomUUID().slice(0, 8));
const MAX_BOTS_PER_SERVER = parseInt(process.env.MAX_BOTS_PER_SERVER, 10) || 60;

const { initSession, question, capacityTracker } = require('./lib/baileys-helper');
const supabase = require('./lib/supabase');
const { updateHeartbeat, setOffline, HEARTBEAT_INTERVAL_MS } = require('./lib/server_registry');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
// const { startAdminApi } = require('./admin_panel/admin_api');

// Global log capturer for Admin Panel
global.botLogs = [];

function safeStringify(obj) {
    try {
        return JSON.stringify(obj, (key, value) => {
            if (key === 'privKey' || key === 'rootKey' || key === 'remoteIdentityKey' || key === 'encKey' || key === 'macKey') return '[REDACTED]';
            if (value && typeof value === 'object') {
                if (value.type === 'Buffer' || Buffer.isBuffer(value)) return '[Buffer]';
                if (value.constructor && value.constructor.name === 'SessionEntry') return '[SessionEntry]';
            }
            return value;
        });
    } catch (e) {
        return '[Unserializable Object]';
    }
}

function addLog(args, type = 'info') {
    const time = new Date().toLocaleTimeString();
    let str = Array.isArray(args) ? args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ') : String(args);
    // Remove ansi color codes from string for clean web display
    str = str.replace(/\x1B\[\d+m/g, '').replace(/\[\d+m/g, '');
    global.botLogs.push({ time, msg: str, type });
    if (global.botLogs.length > 200) global.botLogs.shift();
}

// Suppress verbose baileys output dynamically to reduce terminal/memory strain
const originalLog = console.log;
console.log = function (...args) {
    if (args.some(a => typeof a === 'string' && (a.includes('Closing session:') || a.includes('SessionEntry')))) return;
    
    const safeArgs = args.map(a => {
        if (typeof a === 'object' && a !== null) {
            if (Buffer.isBuffer(a) || a.type === 'Buffer') return '[Buffer]';
            if (a.constructor && a.constructor.name === 'SessionEntry') return '[SessionEntry]';
        }
        return a;
    });
    
    addLog(safeArgs, 'info');
    originalLog.apply(console, safeArgs);
};

const originalError = console.error;
console.error = function (...args) {
    const safeArgs = args.map(a => {
        if (typeof a === 'object' && a !== null) {
            if (Buffer.isBuffer(a) || a.type === 'Buffer') return '[Buffer]';
            if (a.constructor && a.constructor.name === 'SessionEntry') return '[SessionEntry]';
        }
        return a;
    });
    addLog(safeArgs, 'error');
    originalError.apply(console, safeArgs);
};

async function launch() {
  console.log(chalk.cyan(`🚀 Starting MAZARI MD Multi-Session System...`));
  console.log(chalk.gray(`🆔 [PROCESS] ID: ${process.pid} | SERVER_ID: ${global.SERVER_ID}`));

  // Ensure directories exist
  const sessionDir = process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, 'session');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Load configuration from settings.js if needed
  const settings = require('./settings');
  console.log(chalk.green(`✅ Bot Name: ${settings.botName}`));

  // Start the Frontend Web Server for Pairing IMMEDIATELY to prevent Heroku H10 crash
  try {
    const express = require('express');
    const cors = require('cors');
    const { requestPairingCode, pairingCodesStore, sessionStates } = require('./lib/baileys-helper');
    
    const app = express();
    app.use(cors());
    app.use(express.json());
    
    // Serve static files from public directory
    const publicDir = path.join(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }

    app.post('/api/session/pair', async (req, res) => {
      const { number } = req.body;
      if (!number) return res.status(400).json({ error: 'Phone number is required' });
      
      try {
        console.log(chalk.cyan(`🌐 [WEB] Pairing request received for ${number}`));
        
        // Clear any old code from the store so we wait for the NEW code to be generated
        if (global.pairingCodesStore) {
          global.pairingCodesStore.delete(number);
        }

        await requestPairingCode(number, false);
        
        // Wait up to 10 seconds for the code to be generated
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          const code = global.pairingCodesStore ? global.pairingCodesStore.get(number) : null;
          
          if (code) {
            clearInterval(checkInterval);
            if (!res.headersSent) {
              if (code.startsWith('ERROR:')) {
                return res.status(500).json({ error: code.replace('ERROR:', '').trim() });
              }
              return res.json({ success: true, code });
            }
          }
          
          if (attempts > 20) {
            clearInterval(checkInterval);
            if (!res.headersSent) return res.status(500).json({ error: 'Timeout waiting for pairing code. Please try again.' });
          }
        }, 500);
      } catch (err) {
        console.error(chalk.yellow(`⚠️ Web pairing error for ${number}: ${err.message}`));
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error while generating code.' });
      }
    });

    // ── GET /api/health ─────────────────────────────────────────────
    app.get('/api/health', (req, res) => {
      res.json({
        server_id: global.SERVER_ID,
        status: 'ONLINE',
        current_sessions: capacityTracker.getCount(),
        max_sessions: MAX_BOTS_PER_SERVER,
        available_slots: MAX_BOTS_PER_SERVER - capacityTracker.getCount(),
        uptime: Math.floor(process.uptime())
      });
    });

    // ── POST /api/pair (protected by INTERNAL_API_KEY) ──────────────
    app.post('/api/pair', async (req, res) => {
      const internalKey = process.env.INTERNAL_API_KEY;
      if (!internalKey) {
        return res.status(503).json({ error: 'Pairing API not configured (missing INTERNAL_API_KEY).' });
      }
      const provided = req.headers['x-internal-api-key'];
      if (!provided || provided !== internalKey) {
        return res.status(401).json({ error: 'Unauthorized – invalid or missing API key.' });
      }

      const { phone } = req.body;
      if (!phone || !/^\d{10,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Valid phone number is required (digits only, 10-15 chars).' });
      }

      // Check capacity before accepting
      if (capacityTracker.getCount() >= MAX_BOTS_PER_SERVER) {
        return res.status(429).json({ error: 'Server at capacity. No free slots.' });
      }

      try {
        const { requestPairingCode } = require('./lib/baileys-helper');
        
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timeout waiting for pairing code.')), 15000);
        });
        
        const result = await Promise.race([
          requestPairingCode(phone, false),
          timeoutPromise
        ]);
        
        clearTimeout(timer); // Prevent unhandled promise rejection and server crash

        if (result && result.success && result.code) {
          if (!res.headersSent) {
            return res.json({ success: true, code: result.code, server_id: global.SERVER_ID });
          }
        } else {
          if (!res.headersSent) {
            return res.status(500).json({ error: 'Pairing response was invalid or empty.' });
          }
        }
      } catch (err) {
        if (!res.headersSent) {
          const status = err.message.includes('Timeout') ? 504 : 500;
          res.status(status).json({ error: err.message || 'Internal error' });
        }
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(chalk.magenta(`🌐 Frontend UI & Pairing Server running on port ${PORT}`));
    });
  } catch (err) {
    console.log(chalk.yellow(`⚠️ Could not start web server: ${err.message}`));
  }

  // 0. Ensure Data Directory and essential files exist
  const dataDir = path.join(__dirname, 'data');
  const bannedPath = path.join(dataDir, 'banned.json');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(chalk.gray('📁 [SYSTEM] Created data directory.'));
  }
  if (!fs.existsSync(bannedPath)) {
    fs.writeFileSync(bannedPath, JSON.stringify({}, null, 2));
    console.log(chalk.gray('📝 [SYSTEM] Initialized empty banned.json.'));
  }

  // 1. Health check: Try to connect and verify table existence
  let dbConnected = false;
  let dbSessions = [];

  if (supabase.isMock) {
    console.log(chalk.yellow('🔄 No Supabase credentials found. Using local session storage...'));
  } else {
    console.log(chalk.yellow('📡 Checking database connectivity...'));
    try {
      // Fetch ALL sessions to auto-heal the ones broken by the previous upsert bug
      // We use RPC to bypass RLS in case the user has RLS enabled
      let result = await supabase.rpc('get_all_sessions');
      if (result.error && result.error.message.includes('function')) {
          result = await supabase.from('bot_sessions').select('phone_number, session_data, is_paired');
      }
      const { data, error: healthError } = result;
      if (healthError) {
        console.log(chalk.red(`⚠️ DB Connection failed: ${healthError.message}`));
      } else {
        console.log(chalk.green('✅ Supabase connection successful.'));
        dbConnected = true;
        
        // Auto-heal logic: Revive ALL sessions that have backups
        dbSessions = data;
        dbSessions.forEach(row => {
          if (row.session_data && row.session_data.backup && Object.keys(row.session_data.backup).length > 0) {
            if (!row.is_paired) {
                console.log(chalk.green(`🛠️ [AUTO-HEAL] Reviving falsely unpaired session ${row.phone_number}...`));
                supabase.from('bot_sessions').update({ is_paired: true }).eq('phone_number', row.phone_number).then();
                row.is_paired = true;
            }
          }
        });
      }
    } catch (err) {
      console.log(chalk.red(`⚠️ DB Connection failed: ${err.message}`));
    }

    if (!dbConnected) {
      console.log(chalk.yellow('🔄 Falling back to local session storage...'));
    }
  }

  // ── Server Registry: initial heartbeat + 30s interval ─────────────
  if (!supabase.isMock) {
    console.log(chalk.cyan(`📡 Registering server ${global.SERVER_ID} in server_registry...`));
    await updateHeartbeat(global.SERVER_ID, capacityTracker.getCount(), MAX_BOTS_PER_SERVER);
    setInterval(() => {
      updateHeartbeat(global.SERVER_ID, capacityTracker.getCount(), MAX_BOTS_PER_SERVER);
    }, HEARTBEAT_INTERVAL_MS);
  }

  // 2. Initialize/Resume existing sessions
  // 2. Initialize/Resume existing sessions
  let sessionsLoaded = 0;
  if (dbConnected) {
    const pairedSessions = dbSessions || [];
    if (pairedSessions.length === 0) {
      console.log(chalk.yellow(`[STARTUP] Loading all persisted sessions from Supabase...`));
      console.log(chalk.yellow(`[STARTUP] Found 0 persisted sessions.`));
      console.log(chalk.cyan(`🌐 Awaiting new session pairing via Web UI...`));
    } else {
      console.log(chalk.blue(`[STARTUP] Loading all persisted sessions from Supabase...`));
      console.log(chalk.blue(`[STARTUP] Found ${pairedSessions.length} persisted sessions.`));
      for (const session of pairedSessions) {
        const dbPhone = session.phone_number.replace(/[^0-9]/g, '');
        
        const status = session.session_data?.status;
        if (status === 'INACTIVE' || status === 'NEEDS_PAIRING') {
            console.log(chalk.gray(`\n⏭️ [SESSION] Skipping inactive session: ${dbPhone} (Status: ${status})`));
            continue;
        }

        console.log(chalk.gray(`\n[RESTORE] Starting ${dbPhone}...`));
        const hasBackup = !!(session.session_data && session.session_data.backup);
        console.log(chalk.gray(`[RESTORE] Backup exists: ${hasBackup}`));
        const filesCount = hasBackup ? Object.keys(session.session_data.backup).length : 0;
        
        if (hasBackup && filesCount > 1) {
            console.log(chalk.gray(`[RESTORE] Files restored: ${filesCount}`));
            initSession(dbPhone).catch(err => console.error(`Failed to init session ${dbPhone}:`, err));
            sessionsLoaded++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s stagger
        } else {
            console.log(chalk.gray(`[RESTORE] Missing/incomplete backup. Keeping ${dbPhone} IDLE/pending.`));
        }
      }
    }
  } else {
    console.log(chalk.red(`[RESTORE] CRITICAL ERROR: Supabase connection failed. Cannot restore sessions without database.`));
  }

  // Graceful Shutdown - Flush all backups before Heroku kills the dyno
  const gracefulShutdown = async (signal) => {
    console.log(chalk.bgRed(`\n🛑 [SYSTEM] Received ${signal}. Forcing synchronized backup of all sessions before exit...`));
    const { sessions, backupSession, releaseOwnershipOnShutdown } = require('./lib/baileys-helper');
    const activePhones = Array.from(sessions.keys());
    for (const phone of activePhones) {
      console.log(chalk.yellow(`💾 [SHUTDOWN] Force flushing backup for ${phone}...`));
      await backupSession(phone); // ensure we wait for it to complete
    }
    
    // Sync: release ownership ONLY AFTER backups are safely written, avoiding race conditions on JSONB session_data
    if (releaseOwnershipOnShutdown) {
      await releaseOwnershipOnShutdown();
    }
    
    console.log(chalk.green(`✅ [SHUTDOWN] All backups synced to Supabase. Exiting safely.`));
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err) => console.error('💥 Uncaught Exception:', err));
  process.on('unhandledRejection', (reason) => console.error('💥 Unhandled Rejection:', reason));


  // 🛡️ [PRO WATCHDOG] - Monitoring bot health every 10 minutes (Wait, it's actually 30 seconds interval in code)
  setInterval(async () => {
      const { sessionStates, sessionLifecycle, sessions, initSession } = require('./lib/baileys-helper');
      console.log(chalk.blue(`🛡️ [WATCHDOG] Checking health & maintaining ownership of ${sessionStates.size} sessions...`));
      
      for (const [phone, state] of sessionStates.entries()) {
          const lifecycle = sessionLifecycle?.get(phone);
          const sock = sessions.get(phone);
          
          if (state === 'CONNECTED' || (lifecycle && lifecycle.state === 'OPEN')) {
              // Trust Baileys connection state instead of aggressive websocket checks that cause false positives
              if (!sock) {
                  console.log(chalk.yellow(`⚠️ [WATCHDOG] Session ${phone} socket missing despite being CONNECTED. Recovering...`));
                  initSession(phone, { force: true }).catch(e => console.error(e));
              } else if (!supabase.isMock) {
                  // Session is healthy, broadcast heartbeat to lock out other servers
                  try {
                      const { data } = await supabase.from('bot_sessions').select('session_data').eq('phone_number', phone).maybeSingle();
                      const sData = data?.session_data || {};
                      sData.owner_id = global.SERVER_ID;
                      sData.last_active = Date.now();
                      const { error: hbRpcErr } = await supabase.rpc('update_session_data', { p_phone_number: phone, p_session_data: sData });
                      if (hbRpcErr && hbRpcErr.message.includes('function')) {
                          await supabase.from('bot_sessions').update({ session_data: sData }).eq('phone_number', phone);
                      }
                  } catch (e) {
                      // Silently ignore db heartbeat errors
                  }
              }
          } else if (lifecycle) {
              // Watchdog recovery for stuck sessions
              const age = Date.now() - (lifecycle.startedAt || 0);
              const isStuck = age > 180000; // 3 minutes stuck outside of OPEN
              if (isStuck && lifecycle.state !== 'IDLE' && lifecycle.state !== 'STOPPED' && lifecycle.state !== 'CONFLICT' && lifecycle.state !== 'AUTH_INVALID' && lifecycle.state !== 'NEEDS_PAIRING' && lifecycle.state !== 'INACTIVE') {
                  console.log(chalk.red(`⚠️ [WATCHDOG] Session ${phone} STUCK in ${lifecycle.state} for ${Math.round(age/1000)}s. Initiating recovery...`));
                  initSession(phone, { force: true }).catch(e => console.error(e));
              }
          }
      }
      
      // Auto-restart if memory is too high (Safety for t3.micro)
      const m = process.memoryUsage();
      const heapUsedMB = m.heapUsed / 1024 / 1024;
      console.log(chalk.gray(`📊 [MEMORY] RSS: ${(m.rss/1024/1024).toFixed(1)}MB | Heap: ${(m.heapUsed/1024/1024).toFixed(1)}MB | External: ${(m.external/1024/1024).toFixed(1)}MB | ArrayBuffers: ${(m.arrayBuffers/1024/1024).toFixed(1)}MB`));
      
      if (heapUsedMB > 800) {
          console.log(chalk.bgRed(`⚠️ [SYSTEM] Memory usage critical (${heapUsedMB.toFixed(2)}MB). Performing scheduled restart...`));
          process.exit(0); // PM2 will catch this and restart the process fresh
      }
  }, 30 * 1000);

  console.log(chalk.cyan('✨ MAZARI MD is online and waiting for commands.'));
}

launch().catch(err => {
  console.error('Launch failed:', err);
  process.exit(1);
});
