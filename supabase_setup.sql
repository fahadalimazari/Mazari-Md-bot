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

-- Enable RLS but create open policies, or just disable it for backend access
ALTER TABLE bot_sessions DISABLE ROW LEVEL SECURITY;

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
ALTER TABLE server_registry DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- REQUIRED RPC: claim_ownership
-- Used for multi-dyno concurrency control
-- ==========================================
CREATE OR REPLACE FUNCTION public.claim_ownership(
    p_phone_number text,
    p_new_owner text,
    p_ttl_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session bot_sessions%ROWTYPE;
    v_current_owner text;
    v_last_active bigint;
    v_now bigint;
BEGIN
    -- Get current time in ms
    v_now := (extract(epoch from now()) * 1000)::bigint;

    -- Select the session for update
    SELECT * INTO v_session
    FROM bot_sessions
    WHERE phone_number = p_phone_number
    FOR UPDATE;

    IF NOT FOUND THEN
        -- This is a completely new session (e.g. newly paired), register it!
        INSERT INTO bot_sessions (phone_number, session_data)
        VALUES (
            p_phone_number,
            jsonb_build_object('owner_id', p_new_owner, 'last_active', v_now)
        );
        RETURN jsonb_build_object('claimed', true, 'owner', p_new_owner, 'last_active', v_now);
    END IF;

    -- Extract current owner and last active
    v_current_owner := v_session.session_data->>'owner_id';
    v_last_active := COALESCE((v_session.session_data->>'last_active')::bigint, 0);

    -- Check if it's owned by someone else and still active
    IF v_current_owner IS NOT NULL AND v_current_owner != p_new_owner THEN
        IF (v_now - v_last_active) < p_ttl_ms THEN
            -- Still active, cannot claim
            RETURN jsonb_build_object('claimed', false, 'owner', v_current_owner, 'last_active', v_last_active);
        END IF;
    END IF;

    -- Claim it
    UPDATE bot_sessions
    SET session_data = jsonb_set(
        jsonb_set(
            COALESCE(session_data, '{}'::jsonb),
            '{owner_id}',
            to_jsonb(p_new_owner)
        ),
        '{last_active}',
        to_jsonb(v_now)
    )
    WHERE phone_number = p_phone_number;

    RETURN jsonb_build_object('claimed', true, 'owner', p_new_owner, 'last_active', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION update_is_paired(p_phone_number text, p_is_paired boolean) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE bot_sessions SET is_paired = p_is_paired WHERE phone_number = p_phone_number; $$;

CREATE OR REPLACE FUNCTION update_session_data(p_phone_number text, p_session_data jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE bot_sessions SET session_data = p_session_data WHERE phone_number = p_phone_number; $$;

CREATE OR REPLACE FUNCTION get_all_sessions() RETURNS TABLE(phone_number text, session_data jsonb, is_paired boolean) LANGUAGE sql SECURITY DEFINER AS $$ SELECT phone_number, session_data, is_paired FROM bot_sessions; $$;
