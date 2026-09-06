const { initSession } = require('./lib/baileys-helper');
const supabase = require('./lib/supabase');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Loading Mazari Bot Multi-Session System...');

  // Ensure session directory exists
  const sessionDir = path.join(__dirname, 'session');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Load existing sessions from Supabase and auto-heal broken ones
  const { data: allSessions, error } = await supabase
    .from('bot_sessions')
    .select('phone_number, is_paired, session_data');

  let pairedSessions = [];
  if (allSessions) {
    pairedSessions = allSessions.filter(row => {
      if (row.is_paired) return true;
      if (row.session_data && row.session_data.backup && Object.keys(row.session_data.backup).length > 0) {
        console.log(`🛠️ [AUTO-HEAL] Reviving falsely unpaired session ${row.phone_number}...`);
        supabase.from('bot_sessions').update({ is_paired: true }).eq('phone_number', row.phone_number).then();
        return true;
      }
      return false;
    });
  }

  if (error) {
    console.error('❌ Error fetching sessions from Supabase:', error.message);
  } else if (pairedSessions && pairedSessions.length > 0) {
    console.log(`📡 Resuming ${pairedSessions.length} active sessions...`);
    for (const session of pairedSessions) {
      try {
        await initSession(session.phone_number);
        console.log(`✅ Session ${session.phone_number} resumed.`);
      } catch (err) {
        console.error(`❌ Failed to resume session ${session.phone_number}:`, err);
      }
    }
  } else {
    console.log('ℹ️ No active sessions found in database.');
    
    // Check locally for any session directories (in case DB is empty but files exist)
    const localSessions = fs.readdirSync(sessionDir).filter(name => fs.lstatSync(path.join(sessionDir, name)).isDirectory());
    for (const phoneNumber of localSessions) {
       console.log(`📁 Found local session for ${phoneNumber}, initializing...`);
       await initSession(phoneNumber);
    }
  }

  // Handle errors and keep processor alive
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
  });

  console.log('✨ All systems ready.');
}

main().catch(console.error);
