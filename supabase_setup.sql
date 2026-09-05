-- Run this SQL in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  session_data JSONB DEFAULT '{}',
  is_paired BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster phone lookup
CREATE INDEX IF NOT EXISTS idx_bot_sessions_phone ON bot_sessions(phone_number);

-- Enable RLS and add basic policy (optional)
-- ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Multi-Server Registry Table
CREATE TABLE IF NOT EXISTS server_registry (
  server_id TEXT PRIMARY KEY,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_sessions INT NOT NULL DEFAULT 0,
  max_sessions INT NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE','OFFLINE'))
);

-- Index for faster status lookup
CREATE INDEX IF NOT EXISTS idx_server_registry_status ON server_registry(status);
