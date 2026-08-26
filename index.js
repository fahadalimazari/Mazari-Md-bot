require('dotenv').config();
const { initSession, question } = require('./lib/baileys-helper');
const supabase = require('./lib/supabase');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
// const { startAdminApi } = require('./admin_panel/admin_api');

// Global log capturer for Admin Panel
global.botLogs = [];
function addLog(args, type = 'info') {
    const time = new Date().toLocaleTimeString();
    let str = Array.isArray(args) ? args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : String(args);
    // Remove ansi color codes from string for clean web display
    str = str.replace(/\x1B\[\d+m/g, '').replace(/\[\d+m/g, '');
    global.botLogs.push({ time, msg: str, type });
    if (global.botLogs.length > 200) global.botLogs.shift();
}

// Suppress verbose baileys output dynamically to reduce terminal/memory strain
const originalLog = console.log;
console.log = function (...args) {
    if (typeof args[0] === 'string' && args[0].includes('Closing session: SessionEntry')) return;
    addLog(args, 'info');
    originalLog.apply(console, args);
};

const originalError = console.error;
console.error = function (...args) {
    addLog(args, 'error');
    originalError.apply(console, args);
};

async function launch() {
  console.log(chalk.cyan(`🚀 Starting MAZARI MD Multi-Session System...`));
  console.log(chalk.gray(`🆔 [PROCESS] ID: ${process.pid}`));

  // Ensure directories exist
  const sessionDir = process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, 'session');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Load configuration from settings.js if needed
  const settings = require('./settings');
  console.log(chalk.green(`✅ Bot Name: ${settings.botName}`));

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
      const { data, error: healthError } = await supabase.from('bot_sessions').select('phone_number').eq('is_paired', true);
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

  // Start the Frontend Web Server for Pairing
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

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(chalk.magenta(`🌐 Frontend UI & Pairing Server running on http://localhost:${PORT}`));
    });
  } catch (err) {
    console.log(chalk.yellow(`⚠️ Could not start web server: ${err.message}`));
  }

  // 🛡️ [PRO WATCHDOG] - Monitoring bot health every 15 minutes
  setInterval(async () => {
      const { sessionStates, sessions, initSession } = require('./lib/baileys-helper');
      console.log(chalk.blue(`🛡️ [WATCHDOG] Checking health of ${sessionStates.size} sessions...`));
      
      for (const [phone, state] of sessionStates.entries()) {
          if (state === 'CONNECTED') {
              const sock = sessions.get(phone);
              // Verify socket is actually alive by checking its internal state
              if (!sock || !sock.ws || sock.ws.readyState !== 1) { // 1 = OPEN
                  console.log(chalk.yellow(`⚠️ [WATCHDOG] Session ${phone} appears disconnected (ghosting). Automatic recovery is disabled.`));
              }
          }
      }
      
      // Auto-restart if memory is too high (Safety for t3.micro)
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memoryUsage > 800) {
          console.log(chalk.bgRed(`⚠️ [SYSTEM] Memory usage critical (${memoryUsage.toFixed(2)}MB). Performing scheduled restart...`));
          process.exit(0); // PM2 will catch this and restart the process fresh
      }
  }, 15 * 60 * 1000);

  console.log(chalk.cyan('✨ MAZARI MD is online and waiting for commands.'));
}

launch().catch(err => {
  console.error('Launch failed:', err);
  process.exit(1);
});
