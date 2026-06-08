const mainDb = require('./main_db');
const db = mainDb.db;

/**
 * Fetch all peer profiles
 */
function getRelationships(userId) {
    try {
        return db.prepare("SELECT * FROM relationships WHERE user_id = ?").all(userId);
    } catch (e) {
        console.error("relationshipOS: Failed to fetch relationships:", e.message);
        return [];
    }
}

/**
 * Fetch detailed profile information for a peer relationship,
 * compiling all shared events, goals, projects, and notes.
 */
function getRelationshipDetails(userId, relationshipId) {
    const details = {
        peer: null,
        sharedEvents: [],
        sharedGoals: [],
        sharedProjects: [],
        sharedNotes: [],
        milestones: []
    };

    try {
        // Fetch peer basic profile
        details.peer = db.prepare("SELECT * FROM relationships WHERE id = ?").get(relationshipId);
        if (!details.peer) return details;

        // Fetch shared activities IDs from explicit mapping table
        const activities = db.prepare(`
            SELECT * FROM shared_activities 
            WHERE relationship_id = ?
        `).all(relationshipId);

        // Fetch each activity details
        for (const act of activities) {
            if (act.activity_type === 'event') {
                const event = db.prepare("SELECT * FROM tasks WHERE id = ? AND deleted = 0").get(act.target_id);
                if (event) details.sharedEvents.push(event);
            } else if (act.activity_type === 'goal') {
                const goal = db.prepare("SELECT * FROM goals WHERE id = ?").get(act.target_id);
                if (goal) details.sharedGoals.push(goal);
            } else if (act.activity_type === 'project') {
                const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(act.target_id);
                if (project) details.sharedProjects.push(project);
            } else if (act.activity_type === 'note') {
                const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(act.target_id);
                if (note) details.sharedNotes.push(note);
            }
        }

        // Fetch direct shared notes matching peer's relationship ID or group visibility
        const peerNotes = db.prepare(`
            SELECT n.*, g.title as goal_title, p.title as project_title, s.name as subject_name
            FROM notes n
            LEFT JOIN goals g ON n.linked_goal_id = g.id
            LEFT JOIN projects p ON n.linked_project_id = p.id
            LEFT JOIN subjects s ON n.linked_subject_id = s.id
            WHERE n.visibility = 'shared_group' 
               OR (n.visibility = 'shared_specific' AND n.shared_with LIKE ?)
        `).all(`%"${relationshipId}"%`);
        
        peerNotes.forEach(n => {
            try {
                n.shared_with = n.shared_with ? JSON.parse(n.shared_with) : [];
            } catch(e) {
                n.shared_with = [];
            }
            if (!details.sharedNotes.find(exist => exist.id === n.id)) {
                details.sharedNotes.push(n);
            }
        });

        // Fetch direct shared tasks/events matching peer's relationship ID or group visibility
        const peerEvents = db.prepare(`
            SELECT * FROM tasks
            WHERE deleted = 0 
              AND (visibility = 'shared_group' 
                   OR (visibility = 'shared_specific' AND shared_with LIKE ?))
        `).all(`%"${relationshipId}"%`);

        peerEvents.forEach(e => {
            try {
                e.shared_with = e.shared_with ? JSON.parse(e.shared_with) : [];
            } catch(err) {
                e.shared_with = [];
            }
            if (!details.sharedEvents.find(exist => exist.id === e.id)) {
                details.sharedEvents.push(e);
            }
        });

        // Fetch shared milestones from SQLite
        const dbMilestones = db.prepare("SELECT * FROM shared_milestones WHERE peer_id = ? AND deleted = 0").all(relationshipId);
        details.milestones = dbMilestones.map(m => {
            let desc = m.description || '';
            let sharedMeaning = null;
            try {
                if (desc.startsWith('{') && desc.endsWith('}')) {
                    const parsed = JSON.parse(desc);
                    desc = parsed.description || '';
                    sharedMeaning = parsed.sharedMeaning || null;
                }
            } catch(e) {
                // Not JSON, keep as is
            }

            return {
                id: m.id,
                title: m.title,
                description: desc,
                sharedMeaning: sharedMeaning,
                date: m.target_date || new Date(m.created_at).toLocaleDateString(),
                status: m.status
            };
        });

        // Fallback to defaults if empty
        if (details.milestones.length === 0) {
            if (relationshipId === 'rel_princess') {
                details.milestones = [
                    { title: 'Passed Calculus Midterm', date: 'April 2026', description: 'Hard study session', sharedMeaning: { local_user: 'Key checkpoint', peer: 'Cal milestone' } },
                    { title: 'Launched Chrono OS Collaborative Calendar', date: 'May 2026', description: 'Collaborative milestone', sharedMeaning: { local_user: 'MVP Release', peer: 'Beta Launch' } }
                ];
            } else {
                details.milestones = [
                    { title: 'Project Kickoff', date: 'May 2026', description: 'Initial setup' }
                ];
            }
        }

    } catch (e) {
        console.error("relationshipOS: Failed to fetch relationship details:", e.message);
    }

    return details;
}

/**
 * Add a shared activity mapping
 */
function addSharedActivity(relationshipId, activityType, targetId) {
    const id = mainDb.generateUUID();
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO shared_activities (id, relationship_id, activity_type, target_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, relationshipId, activityType, targetId, now, now);
        return { success: true };
    } catch (e) {
        console.error("relationshipOS: Failed to map shared activity:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Add a new peer relationship connection
 */
function addRelationship(userId, name, role, email, peerUserId) {
    const id = mainDb.generateUUID();
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO relationships (id, user_id, name, role, created_at, updated_at, peer_user_id, peer_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, name, role, now, now, peerUserId || null, email || null);
        return { success: true, id };
    } catch (e) {
        console.error("relationshipOS: Failed to add relationship:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Schedule a joint peer study session on the calendar
 * Automatically flags event as 'shared' visibility and links to peer.
 */
async function scheduleJointSession(relationshipId, title, date, startTime, durationMin) {
    const taskUuid = mainDb.generateUUID();
    const seedTime = Date.now();
    const deviceId = mainDb.getDeviceId();

    try {
        // Insert task with 'shared_specific' visibility and map to peer
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, visibility, shared_with)
            VALUES (?, ?, ?, 'study', 0, ?, ?, ?, ?, 0, 0, 'shared_specific', ?)
        `).run(taskUuid, title, date, startTime, durationMin, seedTime, deviceId, JSON.stringify([relationshipId]));

        // Link in shared activities
        db.prepare(`
            INSERT INTO shared_activities (id, relationship_id, activity_type, target_id, created_at, updated_at)
            VALUES (?, ?, 'event', ?, ?, ?)
        `).run(mainDb.generateUUID(), relationshipId, taskUuid, seedTime, seedTime);

        // Fetch peer to see if we can share on Supabase
        const peer = db.prepare("SELECT * FROM relationships WHERE id = ?").get(relationshipId);

        // Ensure study calendar exists locally
        const studyCal = db.prepare("SELECT * FROM calendars WHERE id = 'study'").get();
        if (!studyCal) {
            const authUserId = mainDb.getSyncMeta('auth_user_id') || 'local_user';
            db.prepare(`
                INSERT INTO calendars (id, name, owner_id, layer_type, updated_at, device_id)
                VALUES ('study', 'Study Calendar', ?, 'shared', ?, ?)
            `).run(authUserId, seedTime, deviceId);
        }

        const useCloud = mainDb.getSyncMeta('use_cloud') !== 'false';
        const authUserId = mainDb.getSyncMeta('auth_user_id');
        const authToken = mainDb.getSyncMeta('auth_token');
        const cloudDb = require('./cloudDb');

        if (cloudDb && authUserId && authToken && useCloud) {
            // 1. Ensure the study calendar is created on Supabase
            const { error: calErr } = await cloudDb
                .from('calendars')
                .upsert({
                    id: 'study',
                    name: 'Study Calendar',
                    owner_id: authUserId,
                    layer_type: 'shared',
                    updated_at: seedTime,
                    device_id: deviceId
                });
            if (calErr) console.error("Failed to sync study calendar to Supabase:", calErr.message);

            // 2. Add owner as member on Supabase if not already
            const { error: ownerMemErr } = await cloudDb
                .from('calendar_members')
                .upsert({
                    calendar_id: 'study',
                    user_id: authUserId,
                    role: 'owner',
                    updated_at: seedTime,
                    device_id: deviceId
                });

            // 3. If peer has a peer_user_id, share study calendar with them on Supabase
            if (peer && peer.peer_user_id) {
                const { error: peerMemErr } = await cloudDb
                    .from('calendar_members')
                    .upsert({
                        calendar_id: 'study',
                        user_id: peer.peer_user_id,
                        role: 'editor',
                        updated_at: seedTime,
                        device_id: deviceId
                    });

                if (peerMemErr) {
                    console.error("Failed to share study calendar with peer on Supabase:", peerMemErr.message);
                } else {
                    console.log(`✅ Successfully shared study calendar with peer ${peer.peer_user_id} on Supabase`);
                }
            }

            // 4. Insert joint session event to Supabase events table directly so it's instantly shared
            const { error: evErr } = await cloudDb
                .from('events')
                .upsert({
                    id: taskUuid,
                    calendar_id: 'study',
                    text: title,
                    date: date,
                    completed: 0,
                    start_time: startTime || null,
                    duration_min: durationMin || 60,
                    created_by: authUserId,
                    updated_at: seedTime,
                    device_id: deviceId,
                    deleted: 0
                });
            if (evErr) console.error("Failed to insert joint session event to Supabase:", evErr.message);
        }

        return { success: true, taskId: taskUuid };
    } catch (e) {
        console.error("relationshipOS: Failed to schedule joint session:", e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    getRelationships,
    getRelationshipDetails,
    addSharedActivity,
    addRelationship,
    scheduleJointSession
};
