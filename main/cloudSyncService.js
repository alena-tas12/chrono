const cloudDb = require('./cloudDb');
const observatory = require('./observatory');

/**
 * Direct-to-Supabase Sync Service running in the Electron Main process (Chrono 2.0).
 */
async function pull({ lastSyncTime, deviceId, userId }) {
    if (!cloudDb) {
        throw new Error("Supabase cloud database is not configured.");
    }

    const startTime = Date.now();

    const lastSync = lastSyncTime || 0;
    const devId = deviceId || '';

    // 1. Pull events (relying on RLS to filter by user memberships)
    const { data: events, error: eventError } = await cloudDb
        .from('events')
        .select('*')
        .gt('updated_at', lastSync);

    if (eventError) {
        throw new Error(`Failed to pull events: ${eventError.message}`);
    }

    // Filter events by device_id in JS
    const filteredEvents = (events || []).filter(e => e.device_id !== devId);

    const mappedEvents = filteredEvents.map(e => ({
        id: e.id,
        calendar: e.calendar_id,
        text: e.text,
        date: e.date,
        completed: e.completed,
        start_time: e.start_time,
        duration_min: e.duration_min,
        updated_at: Number(e.updated_at),
        device_id: e.device_id,
        deleted: e.deleted
    }));

    // 2. Pull calendars
    const { data: calendars, error: calError } = await cloudDb
        .from('calendars')
        .select('*')
        .gt('updated_at', lastSync);

    if (calError) {
        throw new Error(`Failed to pull calendars: ${calError.message}`);
    }

    const filteredCalendars = (calendars || []).filter(c => c.device_id !== devId);

    const mappedCalendars = filteredCalendars.map(c => ({
        id: c.id,
        name: c.name,
        owner_id: c.owner_id,
        layer_type: c.layer_type,
        updated_at: Number(c.updated_at),
        device_id: c.device_id,
        deleted: c.deleted
    }));

    // 3. Pull calendar members
    const { data: members, error: memError } = await cloudDb
        .from('calendar_members')
        .select('*')
        .gt('updated_at', lastSync);

    if (memError) {
        throw new Error(`Failed to pull calendar members: ${memError.message}`);
    }

    const filteredMembers = (members || []).filter(m => m.device_id !== devId);

    const mappedMembers = filteredMembers.map(m => ({
        calendar_id: m.calendar_id,
        user_id: m.user_id,
        role: m.role,
        updated_at: Number(m.updated_at),
        device_id: m.device_id,
        deleted: m.deleted
    }));

    // 4. Pull chat history
    const lastSyncIso = new Date(lastSync).toISOString();
    const { data: chats, error: chatError } = await cloudDb
        .from('chat_history')
        .select('*')
        .gt('created_at', lastSyncIso);

    if (chatError) {
        console.error(`Failed to pull chat history: ${chatError.message}`);
    }

    const mappedChats = (chats || []).map(ch => ({
        id: ch.id,
        user_input: ch.user_input,
        ai_response: ch.ai_response,
        timestamp: new Date(ch.created_at).getTime(),
        updated_at: new Date(ch.created_at).getTime(),
        device_id: 'server',
        synced: 1
    }));

    // 5. Pull cognitive memories
    const { data: memories, error: cogMemError } = await cloudDb
        .from('cognitive_memories')
        .select('*')
        .gt('created_at', lastSyncIso);

    if (cogMemError) {
        console.error(`Failed to pull cognitive memories: ${cogMemError.message}`);
    }

    const mappedMemories = (memories || []).map(m => ({
        id: m.id,
        user_id: m.user_id,
        memory_type: m.memory_type,
        content: m.content,
        importance_score: m.importance_score,
        created_at: new Date(m.created_at).getTime(),
        updated_at: new Date(m.created_at).getTime(),
        device_id: 'server',
        synced: 1,
        deleted: 0
    }));

    const latency = Date.now() - startTime;
    observatory.recordSyncPull(latency);

    return {
        serverTime: Date.now(),
        events: mappedEvents,
        calendars: mappedCalendars,
        calendar_members: mappedMembers,
        chats: mappedChats,
        cognitive_memories: mappedMemories
    };
}

async function push({ deviceId, userId, events, calendars, calendar_members, chats, cognitive_memories }) {
    if (!cloudDb) {
        throw new Error("Supabase cloud database is not configured.");
    }

    const startTime = Date.now();

    // 1. Reconcile calendars
    if (calendars && calendars.length > 0) {
        for (const cal of calendars) {
            const { data: existing, error } = await cloudDb
                .from('calendars')
                .select('id, updated_at')
                .eq('id', cal.id)
                .maybeSingle();

            if (error) console.error(`Error querying calendar: ${error.message}`);

            if (!existing) {
                const { error: insErr } = await cloudDb
                    .from('calendars')
                    .insert({
                        id: cal.id,
                        name: cal.name,
                        owner_id: cal.owner_id || userId,
                        layer_type: cal.layer_type || 'personal',
                        updated_at: cal.updated_at,
                        device_id: cal.device_id,
                        deleted: cal.deleted ? 1 : 0
                    });
                if (insErr) console.error(`Error inserting calendar: ${insErr.message}`);
            } else {
                observatory.recordConflictResolved();
                if (cal.updated_at > (existing.updated_at || 0)) {
                    const { error: updErr } = await cloudDb
                        .from('calendars')
                        .update({
                            name: cal.name,
                            owner_id: cal.owner_id || userId,
                            layer_type: cal.layer_type || 'personal',
                            updated_at: cal.updated_at,
                            device_id: cal.device_id,
                            deleted: cal.deleted ? 1 : 0
                        })
                        .eq('id', cal.id);
                    if (updErr) console.error(`Error updating calendar: ${updErr.message}`);
                }
            }
        }
    }

    // 2. Reconcile calendar members
    if (calendar_members && calendar_members.length > 0) {
        for (const mem of calendar_members) {
            const { data: existing, error } = await cloudDb
                .from('calendar_members')
                .select('updated_at')
                .eq('calendar_id', mem.calendar_id)
                .eq('user_id', mem.user_id)
                .maybeSingle();

            if (error) console.error(`Error querying member: ${error.message}`);

            if (!existing) {
                const { error: insErr } = await cloudDb
                    .from('calendar_members')
                    .insert({
                        calendar_id: mem.calendar_id,
                        user_id: mem.user_id,
                        role: mem.role || 'viewer',
                        updated_at: mem.updated_at,
                        device_id: mem.device_id,
                        deleted: mem.deleted ? 1 : 0
                    });
                if (insErr) console.error(`Error inserting member: ${insErr.message}`);
            } else {
                observatory.recordConflictResolved();
                if (mem.updated_at > (existing.updated_at || 0)) {
                    const { error: updErr } = await cloudDb
                        .from('calendar_members')
                        .update({
                            role: mem.role || 'viewer',
                            updated_at: mem.updated_at,
                            device_id: mem.device_id,
                            deleted: mem.deleted ? 1 : 0
                        })
                        .eq('calendar_id', mem.calendar_id)
                        .eq('user_id', mem.user_id);
                    if (updErr) console.error(`Error updating member: ${updErr.message}`);
                }
            }
        }
    }

    // 3. Reconcile events
    if (events && events.length > 0) {
        for (const ev of events) {
            const { data: existing, error } = await cloudDb
                .from('events')
                .select('id, updated_at')
                .eq('id', ev.id)
                .maybeSingle();

            if (error) console.error(`Error querying event: ${error.message}`);

            const calId = ev.calendar_id || ev.calendar;
            if (!existing) {
                const { error: insErr } = await cloudDb
                    .from('events')
                    .insert({
                        id: ev.id,
                        calendar_id: calId,
                        text: ev.text,
                        date: ev.date,
                        completed: ev.completed,
                        start_time: ev.start_time || null,
                        duration_min: ev.duration_min || 60,
                        created_by: userId,
                        updated_at: ev.updated_at,
                        device_id: ev.device_id,
                        deleted: ev.deleted ? 1 : 0
                    });
                if (insErr) console.error(`Error inserting event: ${insErr.message}`);
            } else {
                observatory.recordConflictResolved();
                if (ev.updated_at > (existing.updated_at || 0)) {
                    const { error: updErr } = await cloudDb
                        .from('events')
                        .update({
                            calendar_id: calId,
                            text: ev.text,
                            date: ev.date,
                            completed: ev.completed,
                            start_time: ev.start_time || null,
                            duration_min: ev.duration_min || 60,
                            updated_at: ev.updated_at,
                            device_id: ev.device_id,
                            deleted: ev.deleted ? 1 : 0
                        })
                        .eq('id', ev.id);
                    if (updErr) console.error(`Error updating event: ${updErr.message}`);
                }
            }
        }
    }

    // 4. Reconcile chat history
    if (chats && chats.length > 0) {
        for (const ch of chats) {
            const { data: existing, error } = await cloudDb
                .from('chat_history')
                .select('id')
                .eq('id', ch.id)
                .maybeSingle();

            if (error) console.error(`Error querying chat: ${error.message}`);

            if (!existing) {
                const { error: insErr } = await cloudDb
                    .from('chat_history')
                    .insert({
                        id: ch.id,
                        user_id: userId,
                        user_input: ch.user_input,
                        ai_response: ch.ai_response,
                        model_used: ch.model_used || 'chrono-coordinator-1.0',
                        latency_ms: ch.latency_ms || 0,
                        created_at: new Date(ch.timestamp).toISOString()
                    });
                if (insErr) console.error(`Error inserting chat: ${insErr.message}`);
            }
        }
    }

    // 5. Reconcile cognitive memories
    if (cognitive_memories && cognitive_memories.length > 0) {
        for (const m of cognitive_memories) {
            const { data: existing, error } = await cloudDb
                .from('cognitive_memories')
                .select('id')
                .eq('id', m.id)
                .maybeSingle();

            if (error) console.error(`Error querying memory: ${error.message}`);

            if (!existing) {
                const { error: insErr } = await cloudDb
                    .from('cognitive_memories')
                    .insert({
                        id: m.id,
                        user_id: userId,
                        memory_type: m.memory_type || 'short_term',
                        content: m.content,
                        importance_score: m.importance_score || 5,
                        created_at: new Date(m.created_at || Date.now()).toISOString()
                    });
                if (insErr) console.error(`Error inserting memory: ${insErr.message}`);
            }
        }
    }

    const latency = Date.now() - startTime;
    observatory.recordSyncPush(latency);

    return { success: true };
}

module.exports = {
    pull,
    push
};
