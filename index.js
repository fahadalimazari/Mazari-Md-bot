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
        const { requestPairingCode, pairingCodesStore: localPCS } = require('./lib/baileys-helper');
        // Clear old code so we wait for fresh one
        if (global.pairingCodesStore) {
          global.pairingCodesStore.delete(phone);
        }

        await requestPairingCode(phone, false);

        // Wait up to 15 seconds for the code
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          const code = global.pairingCodesStore ? global.pairingCodesStore.get(phone) : null;

          if (code) {
            clearInterval(checkInterval);
            if (!res.headersSent) {
              if (code.startsWith('ERROR:')) {
                return res.status(500).json({ error: code.replace('ERROR:', '').trim() });
              }
              return res.json({ success: true, code, server_id: global.SERVER_ID });
            }
          }

          if (attempts > 30) { // 30 × 500ms = 15s
            clearInterval(checkInterval);
            if (!res.headersSent) return res.status(500).json({ error: 'Timeout waiting for pairing code.' });
          }
        }, 500);
      } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: 'Internal error: ' + err.message });
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
      const { data, error: healthError } = await supabase.from('bot_sessions').select('phone_number, session_data').eq('is_paired', true);
      if (healthError) {
        console.log(chalk.red(`⚠️ DB Connection failed: ${healthError.message}`));
      } else {
        console.log(chalk.green('✅ Supabase connection successful.'));
        dbConnected = true;
        dbSessions = data || [];
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


  // 2. Autonomous start with target phone number
  let primaryPhone = process.env.OWNER_NUMBER || settings.ownerNumber || '923043514180';
  if (!primaryPhone) {
    primaryPhone = await question(chalk.green('Enter your WhatsApp Phone Number (with country code, e.g., 923...): '));
  }
  
  // Only request pairing code if session directory doesn't exist (i.e. fresh start)
  const primarySessionPath = path.join(sessionDir, primaryPhone);
  const isNewSession = !fs.existsSync(primarySessionPath);
  
  console.log(chalk.yellow(`\n🔄 Auto-initializing session for ${primaryPhone}...`));
  // DO NOT auto-generate pairing code on startup. Wait for web request.
  await initSession(primaryPhone, { usePairingCode: false });

  // 3. Initialize/Resume other existing sessions
  if (dbConnected) {
    const pairedSessions = dbSessions || [];
    if (pairedSessions.length > 0) {
      console.log(chalk.blue(`📡 Resuming ${pairedSessions.length} active sessions from database...`));
      for (const session of pairedSessions) {
        const dbPhone = session.phone_number.replace(/[^0-9]/g, '');
        if (dbPhone !== primaryPhone) {
          initSession(dbPhone).catch(err => console.error(`Failed to init session ${dbPhone}:`, err));
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s stagger
        }
      }
    } else {
      const localSessions = fs.readdirSync(sessionDir).filter(name => fs.lstatSync(path.join(sessionDir, name)).isDirectory());
      const sessionsToLoad = localSessions.filter(phone => phone !== primaryPhone);
      if (sessionsToLoad.length > 0) {
        console.log(chalk.blue(`📁 Resuming ${sessionsToLoad.length} sessions from local storage...`));
        for (const phone of sessionsToLoad) {
          initSession(phone).catch(err => console.error(`Failed to init local session ${phone}:`, err));
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s stagger
        }
      } else {
        console.log(chalk.red('❌ No other active sessions found.'));
      }
    }
  } else {
    const localSessions = fs.readdirSync(sessionDir).filter(name => fs.lstatSync(path.join(sessionDir, name)).isDirectory());
    const sessionsToLoad = localSessions.filter(phone => phone !== primaryPhone);
    if (sessionsToLoad.length > 0) {
      console.log(chalk.blue(`📁 Loading ${sessionsToLoad.length} sessions from local storage...`));
      for (const phone of sessionsToLoad) {
        initSession(phone).catch(err => console.error(`Failed to init local session ${phone}:`, err));
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s stagger
      }
    } else {
      console.log(chalk.red('❌ No other active sessions found.'));
    }
  }

  process.on('uncaughtException', (err) => console.error('💥 Uncaught Exception:', err));
  process.on('unhandledRejection', (reason) => console.error('💥 Unhandled Rejection:', reason));


  // 🛡️ [PRO WATCHDOG] - Monitoring bot health every 10 minutes
  setInterval(async () => {
      const { sessionStates, sessions, initSession } = require('./lib/baileys-helper');
      console.log(chalk.blue(`🛡️ [WATCHDOG] Checking health & maintaining ownership of ${sessionStates.size} sessions...`));
      
      for (const [phone, state] of sessionStates.entries()) {
          if (state === 'CONNECTED') {
              const sock = sessions.get(phone);
              // Trust Baileys connection state instead of aggressive websocket checks that cause false positives
              if (!sock) {
                  console.log(chalk.yellow(`⚠️ [WATCHDOG] Session ${phone} socket missing. Automatic recovery is disabled.`));
              } else if (!supabase.isMock) {
                  // Session is healthy, broadcast heartbeat to lock out other servers
                  try {
                      const { data } = await supabase.from('bot_sessions').select('session_data').eq('phone_number', phone).maybeSingle();
                      const sData = data?.session_data || {};
                      sData.owner_id = global.SERVER_ID;
                      sData.last_active = Date.now();
                      await supabase.from('bot_sessions').update({ session_data: sData }).eq('phone_number', phone);
                  } catch (e) {
                      // Silently ignore db heartbeat errors
                  }
              }
          }
      }
      
      // Auto-restart if memory is too high (Safety for t3.micro)
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const rssMB = memUsage.rss / 1024 / 1024;
      
      console.log(chalk.gray(`📊 [MEMORY] RSS: ${rssMB.toFixed(2)}MB | Heap: ${heapUsedMB.toFixed(2)}MB`));
      
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
