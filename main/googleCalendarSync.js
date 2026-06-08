const mainDb = require('./main_db');

/**
 * Syncs events from the user's primary Google Calendar.
 * 
 * @param {string} userId - The user's Supabase UUID.
 * @returns {Promise<{success: boolean, imported: number, message?: string}>}
 */
async function syncGoogleCalendar(userId) {
    const token = mainDb.getSyncMeta('google_provider_token');
    if (!token) {
        console.log("ℹ️ Google Cloud Sync: No google_provider_token found. Skipping Google Calendar Sync.");
        return { success: false, imported: 0, message: "No Google provider token found. Log in via Google first." };
    }

    console.log("🔄 Google Cloud Sync: Querying Google Calendar API...");
    try {
        // Query events from 30 days ago to 60 days in the future
        const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=150&singleEvents=true&orderBy=startTime`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Google API returned status ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const items = data.items || [];
        console.log(`📥 Google Cloud Sync: Retrieved ${items.length} events.`);

        const db = mainDb.db;
        const deviceId = mainDb.getDeviceId();
        let importedCount = 0;

        // Prepare statements
        const checkStmt = db.prepare('SELECT updated_at FROM tasks WHERE id = ?');
        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO tasks (
                id, text, date, calendar, completed, start_time, duration_min, 
                updated_at, device_id, synced, deleted, visibility, shared_with
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'private', '[]')
        `);

        db.transaction(() => {
            for (const item of items) {
                // Ignore cancelled events
                if (item.status === 'cancelled') continue;

                const eventId = `e_gcal_${item.id}`;
                const text = item.summary || 'Google Calendar Event';
                
                // Parse date and start_time
                let eventDate = '';
                let startTime = null;
                let durationMin = 60;

                if (item.start && item.start.dateTime) {
                    const startDt = new Date(item.start.dateTime);
                    eventDate = startDt.toISOString().split('T')[0];
                    startTime = startDt.toTimeString().substring(0, 5); // "HH:MM"
                    
                    if (item.end && item.end.dateTime) {
                        const endDt = new Date(item.end.dateTime);
                        durationMin = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / (60 * 1000)));
                    }
                } else if (item.start && item.start.date) {
                    // All-day event
                    eventDate = item.start.date;
                    startTime = null; // null represents all-day
                    
                    if (item.end && item.end.date) {
                        const startDt = new Date(item.start.date);
                        const endDt = new Date(item.end.date);
                        durationMin = Math.max(60, Math.round((endDt.getTime() - startDt.getTime()) / (60 * 1000)));
                    }
                } else {
                    // Skip if no valid start info
                    continue;
                }

                // Google's updated field acts as the source timestamp
                const googleUpdatedAt = item.updated ? new Date(item.updated).getTime() : Date.now();

                // Check local copy
                const local = checkStmt.get(eventId);

                // Reconcile: If not exists locally, or if Google is newer
                if (!local || googleUpdatedAt > local.updated_at) {
                    insertStmt.run(
                        eventId,
                        text,
                        eventDate,
                        'personal', // Import into 'personal' calendar layer
                        0, // completed defaults to 0
                        startTime,
                        durationMin,
                        googleUpdatedAt,
                        deviceId
                    );
                    importedCount++;
                }
            }
        })();

        console.log(`✅ Google Cloud Sync: Successfully merged ${importedCount} new/updated events.`);
        return { success: true, imported: importedCount };

    } catch (err) {
        console.error("❌ Google Cloud Sync Error:", err.message || err);
        return { success: false, imported: 0, error: err.message };
    }
}

module.exports = {
    syncGoogleCalendar
};
