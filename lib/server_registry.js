const supabase = require('./supabase');

// Configuration (can be overridden via env variables)
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const STALE_THRESHOLD_MS = 90 * 1000; // 90 seconds without heartbeat -> considered dead

/**
 * Update this server's heartbeat entry in `server_registry`.
 * Upserts the row with the latest timestamp and current session count.
 * @param {string} serverId - Unique identifier for this server (process.env.SERVER_ID)
 * @param {number} currentSessions - Number of active sessions on this server.
 * @param {number} maxSessions - Maximum sessions allowed per server.
 */
async function updateHeartbeat(serverId, currentSessions, maxSessions) {
  try {
    await supabase.from('server_registry').upsert({
      server_id: serverId,
      last_heartbeat: new Date().toISOString(),
      current_sessions: currentSessions,
      max_sessions: maxSessions,
      status: 'ONLINE'
    }, { onConflict: 'server_id' });
  } catch (e) {
    console.warn('⚠️ Failed to update server heartbeat:', e.message);
  }
}

/**
 * Mark this server as OFFLINE (used on graceful shutdown).
 */
async function setOffline(serverId) {
  try {
    await supabase.from('server_registry').update({
      status: 'OFFLINE',
      current_sessions: 0,
      last_heartbeat: new Date().toISOString()
    }).eq('server_id', serverId);
  } catch (e) {
    console.warn('⚠️ Failed to set server offline:', e.message);
  }
}

/**
 * Retrieve an available server (ONLINE, not full, heartbeat within 90s)
 * with the lowest current_sessions.
 *
 * supabase.raw() does NOT exist in Supabase JS client / PostgREST,
 * so we fetch all ONLINE servers and filter in JS for:
 *   1. current_sessions < max_sessions  (has free slots)
 *   2. last_heartbeat within STALE_THRESHOLD_MS  (server is alive)
 *
 * Returns the server object or null if none are available.
 */
async function getAvailableServer() {
  try {
    const { data, error } = await supabase
      .from('server_registry')
      .select('*')
      .eq('status', 'ONLINE')
      .order('current_sessions', { ascending: true });

    if (error) {
      console.warn('⚠️ Failed to fetch available servers:', error.message);
      return null;
    }
    if (!data || data.length === 0) return null;

    const now = Date.now();
    // Filter: has free slots AND heartbeat is fresh (within 90s)
    const available = data.find(server => {
      const hbAge = now - new Date(server.last_heartbeat).getTime();
      return server.current_sessions < server.max_sessions && hbAge < STALE_THRESHOLD_MS;
    });

    return available || null;
  } catch (e) {
    console.warn('⚠️ Failed to fetch available server:', e.message);
    return null;
  }
}

module.exports = {
  updateHeartbeat,
  setOffline,
  getAvailableServer,
  HEARTBEAT_INTERVAL_MS,
  STALE_THRESHOLD_MS
};
