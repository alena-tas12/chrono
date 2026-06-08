const http = require('http');
const mainDb = require('./main_db');

let syncIntervalId = null;
let isSyncing = false;
let syncServerUrl = 'http://localhost:5000'; // Default, configurable

// Read server URL from database preferences or environment
function getServerUrl() {
    const saved = mainDb.getSyncMeta('server_url');
    if (saved) return saved;
    return process.env.CHRONO_SYNC_SERVER || syncServerUrl;
}

function setServerUrl(url) {
    mainDb.setSyncMeta('server_url', url);
}

// Request Helper using Node http
function makeRequest(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const urlStr = getServerUrl();
        let host = 'localhost';
        let port = 5000;
        let protocol = 'http:';

        try {
            const url = new URL(urlStr);
            host = url.hostname;
            port = url.port || (url.protocol === 'https:' ? 443 : 80);
            protocol = url.protocol;
        } catch (e) {
            // Fallback
        }

        const payload = body ? JSON.stringify(body) : '';
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Import correct module
        const client = protocol === 'https:' ? require('https') : http;

        const req = client.request({
            host,
            port,
            path,
            method,
            headers,
            timeout: 5000 // 5 seconds timeout
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, error: parsed });
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, error: data });
                    } else {
                        resolve(data);
                    }
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });

        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

// Core Sync Function
async function performSync() {
    if (isSyncing) return;
    const token = mainDb.getSyncMeta('auth_token');
    const userId = mainDb.getSyncMeta('auth_user_id');
    if (!token || !userId) return; // Not logged in

    isSyncing = true;
    console.log("🔄 Sync Engine: Initiating direct sync cycle...");

    try {
        const lastSyncTime = parseInt(mainDb.getSyncMeta('last_sync_time') || '0');
        const deviceId = mainDb.getDeviceId();
        const cloudSync = require('./cloudSyncService');

        // ========================================
        // 1. PULL CYCLE
        // ========================================
        console.log(`🔄 Sync Engine: Pulling updates directly from Supabase since ${lastSyncTime}...`);
        const pullRes = await cloudSync.pull({ lastSyncTime, deviceId, userId });
        const serverTime = pullRes.serverTime || Date.now();

        // Reconcile pulled events (tasks)
        if (pullRes.events && pullRes.events.length > 0) {
            const db = mainDb.db;
            const checkStmt = db.prepare('SELECT updated_at, deleted FROM tasks WHERE id = ?');
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `);

            for (const event of pullRes.events) {
                const local = checkStmt.get(event.id);
                // If local does not exist, or remote is newer
                if (!local || event.updated_at > local.updated_at) {
                    insertStmt.run(
                        event.id,
                        event.text,
                        event.date,
                        event.calendar || 'personal',
                        event.completed ? 1 : 0,
                        event.start_time || null,
                        event.duration_min || 60,
                        event.updated_at,
                        event.device_id,
                        event.deleted ? 1 : 0
                    );
                }
            }
            console.log(`✅ Synced ${pullRes.events.length} events from Supabase.`);
        }

        // Reconcile calendars
        if (pullRes.calendars && pullRes.calendars.length > 0) {
            const db = mainDb.db;
            const checkStmt = db.prepare('SELECT updated_at FROM calendars WHERE id = ?');
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO calendars (id, name, owner_id, layer_type, updated_at, device_id, synced, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            `);
            for (const cal of pullRes.calendars) {
                const local = checkStmt.get(cal.id);
                if (!local || cal.updated_at > local.updated_at) {
                    insertStmt.run(cal.id, cal.name, cal.owner_id, cal.layer_type, cal.updated_at, cal.device_id, cal.deleted ? 1 : 0);
                }
            }
        }

        // Reconcile calendar members
        if (pullRes.calendar_members && pullRes.calendar_members.length > 0) {
            const db = mainDb.db;
            const checkStmt = db.prepare('SELECT updated_at FROM calendar_members WHERE calendar_id = ? AND user_id = ?');
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO calendar_members (calendar_id, user_id, role, updated_at, device_id, synced, deleted)
                VALUES (?, ?, ?, ?, ?, 1, ?)
            `);
            for (const mem of pullRes.calendar_members) {
                const local = checkStmt.get(mem.calendar_id, mem.user_id);
                if (!local || mem.updated_at > local.updated_at) {
                    insertStmt.run(mem.calendar_id, mem.user_id, mem.role, mem.updated_at, mem.device_id, mem.deleted ? 1 : 0);
                }
            }
        }

        // Reconcile pulled chat history
        if (pullRes.chats && pullRes.chats.length > 0) {
            const db = mainDb.db;
            const checkStmt = db.prepare('SELECT updated_at FROM memory_chat WHERE id = ?');
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO memory_chat (id, user_input, ai_response, timestamp, updated_at, device_id, synced)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `);
            for (const ch of pullRes.chats) {
                const local = checkStmt.get(ch.id);
                if (!local || ch.updated_at > local.updated_at) {
                    insertStmt.run(ch.id, ch.user_input, ch.ai_response, ch.timestamp, ch.updated_at, ch.device_id);
                }
            }
            console.log(`✅ Synced ${pullRes.chats.length} chat history items from Supabase.`);
        }

        // Reconcile pulled cognitive memories
        if (pullRes.cognitive_memories && pullRes.cognitive_memories.length > 0) {
            const db = mainDb.db;
            const checkStmt = db.prepare('SELECT updated_at FROM cognitive_memories WHERE id = ?');
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `);
            for (const mem of pullRes.cognitive_memories) {
                const local = checkStmt.get(mem.id);
                if (!local || mem.updated_at > local.updated_at) {
                    insertStmt.run(
                        mem.id,
                        mem.user_id,
                        mem.memory_type,
                        mem.content,
                        mem.importance_score,
                        mem.created_at,
                        mem.updated_at,
                        mem.device_id,
                        mem.deleted ? 1 : 0
                    );
                }
            }
            console.log(`✅ Synced ${pullRes.cognitive_memories.length} cognitive memories from Supabase.`);
        }

        // ========================================
        // 2. PUSH CYCLE
        // ========================================
        console.log("🔄 Sync Engine: Checking for local unsynced edits...");
        const db = mainDb.db;

        const unsyncedEvents = db.prepare('SELECT * FROM tasks WHERE synced = 0').all();
        const unsyncedCalendars = db.prepare('SELECT * FROM calendars WHERE synced = 0').all();
        const unsyncedMembers = db.prepare('SELECT * FROM calendar_members WHERE synced = 0').all();
        const unsyncedChats = db.prepare('SELECT * FROM memory_chat WHERE synced = 0').all();
        const unsyncedMemories = db.prepare('SELECT * FROM cognitive_memories WHERE synced = 0').all();

        if (unsyncedEvents.length > 0 || unsyncedCalendars.length > 0 || unsyncedMembers.length > 0 || unsyncedChats.length > 0 || unsyncedMemories.length > 0) {
            console.log(`🔄 Sync Engine: Pushing unsynced local changes directly to Supabase...`);
            
            await cloudSync.push({
                deviceId,
                userId,
                events: unsyncedEvents.map(e => ({
                    id: e.id,
                    text: e.text,
                    date: e.date,
                    calendar: e.calendar,
                    completed: e.completed === 1,
                    start_time: e.start_time,
                    duration_min: e.duration_min,
                    updated_at: e.updated_at,
                    device_id: e.device_id,
                    deleted: e.deleted === 1
                })),
                calendars: unsyncedCalendars.map(c => ({
                    id: c.id,
                    name: c.name,
                    owner_id: c.owner_id,
                    layer_type: c.layer_type,
                    updated_at: c.updated_at,
                    device_id: c.device_id,
                    deleted: c.deleted === 1
                })),
                calendar_members: unsyncedMembers.map(m => ({
                    calendar_id: m.calendar_id,
                    user_id: m.user_id,
                    role: m.role,
                    updated_at: m.updated_at,
                    device_id: m.device_id,
                    deleted: m.deleted === 1
                })),
                chats: unsyncedChats.map(ch => ({
                    id: ch.id,
                    user_input: ch.user_input,
                    ai_response: ch.ai_response,
                    timestamp: ch.timestamp,
                    updated_at: ch.updated_at,
                    device_id: ch.device_id
                })),
                cognitive_memories: unsyncedMemories.map(m => ({
                    id: m.id,
                    user_id: m.user_id,
                    memory_type: m.memory_type,
                    content: m.content,
                    importance_score: m.importance_score,
                    created_at: m.created_at,
                    updated_at: m.updated_at,
                    device_id: m.device_id,
                    deleted: m.deleted === 1
                }))
            });

            // Mark local changes as synced
            if (unsyncedEvents.length > 0) {
                const markStmt = db.prepare('UPDATE tasks SET synced = 1 WHERE id = ?');
                for (const e of unsyncedEvents) markStmt.run(e.id);
            }
            if (unsyncedCalendars.length > 0) {
                const markStmt = db.prepare('UPDATE calendars SET synced = 1 WHERE id = ?');
                for (const c of unsyncedCalendars) markStmt.run(c.id);
            }
            if (unsyncedMembers.length > 0) {
                const markStmt = db.prepare('UPDATE calendar_members SET synced = 1 WHERE calendar_id = ? AND user_id = ?');
                for (const m of unsyncedMembers) markStmt.run(m.calendar_id, m.user_id);
            }
            if (unsyncedChats.length > 0) {
                const markStmt = db.prepare('UPDATE memory_chat SET synced = 1 WHERE id = ?');
                for (const ch of unsyncedChats) markStmt.run(ch.id);
            }
            if (unsyncedMemories.length > 0) {
                const markStmt = db.prepare('UPDATE cognitive_memories SET synced = 1 WHERE id = ?');
                for (const m of unsyncedMemories) markStmt.run(m.id);
            }
            console.log("✅ Sync Engine: Successfully pushed local changes to Supabase.");
        }

        // Update last sync time metadata
        mainDb.setSyncMeta('last_sync_time', serverTime);
        console.log(`✅ Direct sync cycle complete at timestamp: ${serverTime}`);

        // Sync with Google Calendar if connected
        const googleProviderToken = mainDb.getSyncMeta('google_provider_token');
        if (googleProviderToken) {
            try {
                const googleCalendarSync = require('./googleCalendarSync');
                await googleCalendarSync.syncGoogleCalendar(userId);
            } catch (gcalErr) {
                console.warn("⚠️ Google Calendar sync failed during sync cycle:", gcalErr.message);
            }
        }
    } catch (e) {
        console.warn("⚠️ Direct sync cycle failed:", e.message || e);
    } finally {
        isSyncing = false;
    }
}

// Start Background Loop
function startSyncLoop(intervalMs = 10000) {
    if (syncIntervalId) clearInterval(syncIntervalId);
    
    // Perform initial sync after boot
    setTimeout(performSync, 2000);
    
    syncIntervalId = setInterval(performSync, intervalMs);
    console.log(`🚀 Sync Engine: Background sync loop started (interval: ${intervalMs}ms).`);
}

function stopSyncLoop() {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        console.log("🛑 Sync Engine: Sync loop stopped.");
    }
}

module.exports = {
    startSyncLoop,
    stopSyncLoop,
    triggerSync: performSync,
    getServerUrl,
    setServerUrl
};
