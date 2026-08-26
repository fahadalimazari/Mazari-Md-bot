# Permanent Rule: Multi-Session Isolation Architecture

## Context
This project implements a multi-session architecture where a single Node.js process manages multiple independent WhatsApp bots (connected via the `.pair` command).

## The Core Rule
From now on, **every new command, feature, method, function, auto feature, anti feature, setting, configuration, cache, timer, cooldown, or any other bot-specific functionality added to this project must automatically work independently for every paired WhatsApp session.**

Whenever any new functionality is added, you MUST:
1. Identify the current `sessionId`. (e.g., `getSessionId(sock)`)
2. Use that session's specific socket connection.
3. Read that session's specific data/settings from `sessionManager.readSessionData`.
4. Execute the logic ONLY for that session.
5. Save changes ONLY for that session via `sessionManager.writeSessionData`.

### Developer Constraints
Do NOT create bot-specific features using shared global state such as:
- `global.setting`
- `global.config`
- `sharedConfig`
- single JSON files reading directly from `../data/`
- single cache (e.g., `const cache = new Map();` at the top level)
- single Map or Set for bot state

Instead, use:
- `sessionManager.getCache(sessionId, 'cacheName')` for in-memory Maps/Sets.
- `sessionManager.readSessionData(sessionId, 'fileName.json')` for persistent data.

### Final Verification
Before writing any code or proposing a plan, ask yourself:
"If three different users connect to this bot using `.pair`, will this feature act differently and independently for each user?" 
If the answer is no, your implementation violates this architectural requirement.
