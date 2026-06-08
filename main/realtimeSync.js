const { BrowserWindow } = require('electron');
const cloudDb = require('./cloudDb');
const mainDb = require('./main_db');

let subscriptionChannel = null;

function notifyRendererOfUpdate(table) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send('realtime-db-update', { table });
    }
}

/**
 * Initializes Supabase Realtime subscription for the active user session.
 */
function initializeRealtimeSync(userJwt, userId) {
    if (!cloudDb) {
        console.warn("⚠️ Realtime Sync: Cloud database client is not initialized.");
        return null;
    }

    if (subscriptionChannel) {
        console.log("🔄 Realtime Sync: Unsubscribing existing channel...");
        subscriptionChannel.unsubscribe();
        subscriptionChannel = null;
    }

    console.log(`🔌 Realtime Sync: Connecting WebSocket for user: ${userId}...`);

    try {
        // Authenticate the websocket connection with the active user JWT
        cloudDb.auth.setSession({ access_token: userJwt, refresh_token: '' });

        subscriptionChannel = cloudDb
            .channel('chrono-realtime-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'events' },
                (payload) => {
                    handleRealtimeUpdate('events', payload, userId);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'calendars' },
                (payload) => {
                    handleRealtimeUpdate('calendars', payload, userId);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'calendar_members' },
                (payload) => {
                    handleRealtimeUpdate('calendar_members', payload, userId);
                }
            )
            .subscribe((status) => {
                console.log(`📡 Realtime Sync Status: ${status}`);
            });

        return subscriptionChannel;
    } catch (e) {
        console.error("⚠️ Realtime Sync initialization failed:", e.message);
        return null;
    }
}

/**
 * Reconciles incoming changes from Supabase with the local SQLite database.
 */
function handleRealtimeUpdate(table, payload, currentUserId) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const db = mainDb.db;
    const deviceId = mainDb.getDeviceId();

    console.log(`🔔 Realtime Change Detected [${table}] -> Event: ${eventType}`);

    // Skip updates originating from this device to prevent duplicate operations
    if (newRecord && newRecord.device_id === deviceId) {
        return;
    }

    try {
        if (table === 'events') {
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const local = db.prepare('SELECT updated_at FROM tasks WHERE id = ?').get(newRecord.id);
                const remoteUpdatedAt = Number(newRecord.updated_at);
                
                if (!local || remoteUpdatedAt > local.updated_at) {
                    db.prepare(`
                        INSERT OR REPLACE INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                    `).run(
                        newRecord.id,
                        newRecord.text,
                        newRecord.date,
                        newRecord.calendar_id || 'personal',
                        newRecord.completed ? 1 : 0,
                        newRecord.start_time || null,
                        newRecord.duration_min || 60,
                        remoteUpdatedAt,
                        newRecord.device_id,
                        newRecord.deleted ? 1 : 0
                    );
                    notifyRendererOfUpdate('tasks');
                }
            } else if (eventType === 'DELETE') {
                db.prepare('UPDATE tasks SET deleted = 1, synced = 1 WHERE id = ?').run(oldRecord.id);
                notifyRendererOfUpdate('tasks');
            }
        } 
        else if (table === 'calendars') {
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const local = db.prepare('SELECT updated_at FROM calendars WHERE id = ?').get(newRecord.id);
                const remoteUpdatedAt = Number(newRecord.updated_at);

                if (!local || remoteUpdatedAt > local.updated_at) {
                    db.prepare(`
                        INSERT OR REPLACE INTO calendars (id, name, owner_id, layer_type, updated_at, device_id, synced, deleted)
                        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                    `).run(
                        newRecord.id,
                        newRecord.name,
                        newRecord.owner_id,
                        newRecord.layer_type || 'personal',
                        remoteUpdatedAt,
                        newRecord.device_id,
                        newRecord.deleted ? 1 : 0
                    );
                    notifyRendererOfUpdate('calendars');
                }
            } else if (eventType === 'DELETE') {
                db.prepare('UPDATE calendars SET deleted = 1, synced = 1 WHERE id = ?').run(oldRecord.id);
                notifyRendererOfUpdate('calendars');
            }
        }
        else if (table === 'calendar_members') {
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const local = db.prepare('SELECT updated_at FROM calendar_members WHERE calendar_id = ? AND user_id = ?').get(newRecord.calendar_id, newRecord.user_id);
                const remoteUpdatedAt = Number(newRecord.updated_at);

                if (!local || remoteUpdatedAt > local.updated_at) {
                    db.prepare(`
                        INSERT OR REPLACE INTO calendar_members (calendar_id, user_id, role, updated_at, device_id, synced, deleted)
                        VALUES (?, ?, ?, ?, ?, 1, ?)
                    `).run(
                        newRecord.calendar_id,
                        newRecord.user_id,
                        newRecord.role || 'viewer',
                        remoteUpdatedAt,
                        newRecord.device_id,
                        newRecord.deleted ? 1 : 0
                    );
                    notifyRendererOfUpdate('calendar_members');
                }
            } else if (eventType === 'DELETE') {
                db.prepare('UPDATE calendar_members SET deleted = 1, synced = 1 WHERE calendar_id = ? AND user_id = ?').run(oldRecord.calendar_id, oldRecord.user_id);
                notifyRendererOfUpdate('calendar_members');
            }
        }
    } catch (e) {
        console.error(`⚠️ Error reconciling realtime table [${table}] change:`, e.message);
    }
}

function closeRealtimeSync() {
    if (subscriptionChannel) {
        console.log("🛑 Realtime Sync: Unsubscribing channel...");
        try {
            subscriptionChannel.unsubscribe();
        } catch (e) {}
        subscriptionChannel = null;
    }
}

module.exports = {
    initializeRealtimeSync,
    closeRealtimeSync
};
