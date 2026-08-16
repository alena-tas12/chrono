const mainDb = require('./main_db');
const db = mainDb.db;

/**
 * Helper to calculate and cache continuity metrics for a peer thread
 */
function computeContinuityMetrics(peerId) {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    const sixtyDaysAgo = now - 60 * 86400000;

    try {
        // 1. Last interaction timestamp
        const lastIntRow = db.prepare(`
            SELECT MAX(timestamp) as last_time 
            FROM relationship_interactions 
            WHERE peer_id = ?
        `).get(peerId);
        const lastInteraction = lastIntRow && lastIntRow.last_time ? lastIntRow.last_time : null;

        // 2. Count shared completed milestones
        const milRow = db.prepare(`
            SELECT COUNT(*) as count 
            FROM shared_milestones 
            WHERE peer_id = ? AND status = 'completed' AND deleted = 0
        `).get(peerId);
        const completedMilestones = milRow ? milRow.count : 0;

        // 3. Count shared projects (from shared activities)
        const projRow = db.prepare(`
            SELECT COUNT(*) as count 
            FROM shared_activities 
            WHERE relationship_id = ? AND activity_type = 'project'
        `).get(peerId);
        const sharedProjects = projRow ? projRow.count : 0;

        // 4. Count recent interactions (last 30 days)
        const recentRow = db.prepare(`
            SELECT COUNT(*) as count 
            FROM relationship_interactions 
            WHERE peer_id = ? AND timestamp >= ?
        `).get(peerId, thirtyDaysAgo);
        const countLast30 = recentRow ? recentRow.count : 0;

        // 5. Count historical interactions (30-60 days ago)
        const histRow = db.prepare(`
            SELECT COUNT(*) as count 
            FROM relationship_interactions 
            WHERE peer_id = ? AND timestamp >= ? AND timestamp < ?
        `).get(peerId, sixtyDaysAgo, thirtyDaysAgo);
        const countPrev30 = histRow ? histRow.count : 0;

        // Determine trend: Growing, Stable, or Drifting (No gamified percentages!)
        let trend = 'Stable';
        if (countLast30 > countPrev30) {
            trend = 'Growing';
        } else if (countLast30 === 0 && countPrev30 > 0) {
            trend = 'Drifting';
        } else if (countLast30 < countPrev30 && countLast30 < 2) {
            trend = 'Drifting';
        }

        // Determine Continuity Score: High, Medium, Low based on weights
        const weightScore = (countLast30 * 10) + (countPrev30 * 5) + (completedMilestones * 15) + (sharedProjects * 20);
        let continuityScore = 'Low';
        if (weightScore >= 50) {
            continuityScore = 'High';
        } else if (weightScore >= 15) {
            continuityScore = 'Medium';
        }

        // Upsert cached metrics
        db.prepare(`
            INSERT OR REPLACE INTO continuity_metrics (
                peer_id, continuity_score, trend, last_interaction, 
                shared_projects, shared_milestones, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(peerId, continuityScore, trend, lastInteraction, sharedProjects, completedMilestones, now);

        return {
            continuityScore,
            trend,
            lastInteraction,
            sharedProjects,
            sharedMilestones: completedMilestones
        };
    } catch (e) {
        console.error(`Failed to calculate metrics for thread ${peerId}:`, e.message);
        return {
            continuityScore: 'Medium',
            trend: 'Stable',
            lastInteraction: null,
            sharedProjects: 0,
            sharedMilestones: 0
        };
    }
}

/**
 * Fetch all continuity threads (peers)
 */
function getThreads(userId) {
    try {
        const peers = db.prepare("SELECT * FROM relationships WHERE user_id = ?").all(userId);
        return peers.map(peer => {
            const metrics = computeContinuityMetrics(peer.id);
            return {
                ...peer,
                metrics
            };
        });
    } catch (e) {
        console.error("continuityThreads: Failed to fetch threads:", e.message);
        return [];
    }
}

/**
 * Fetch detailed thread information for a peer,
 * compiling shared events, goals, projects, notes, milestones, and memories.
 */
function getThreadDetails(userId, peerId) {
    const details = {
        peer: null,
        metrics: null,
        sharedEvents: [],
        sharedGoals: [],
        sharedProjects: [],
        sharedNotes: [],
        milestones: [],
        sharedMemories: []
    };

    try {
        // Fetch basic profile
        details.peer = db.prepare("SELECT * FROM relationships WHERE id = ?").get(peerId);
        if (!details.peer) return details;

        // Calculate and attach fresh metrics
        details.metrics = computeContinuityMetrics(peerId);

        // Fetch shared activities mapped in shared_activities
        const activities = db.prepare(`
            SELECT * FROM shared_activities 
            WHERE relationship_id = ?
        `).all(peerId);

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

        // Fetch direct shared notes matching peer ID or group visibility
        const peerNotes = db.prepare(`
            SELECT n.*, g.title as goal_title, p.title as project_title, s.name as subject_name
            FROM notes n
            LEFT JOIN goals g ON n.linked_goal_id = g.id
            LEFT JOIN projects p ON n.linked_project_id = p.id
            LEFT JOIN subjects s ON n.linked_subject_id = s.id
            WHERE n.visibility = 'shared_group' 
               OR (n.visibility = 'shared_specific' AND n.shared_with LIKE ?)
        `).all(`%"${peerId}"%`);
        
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

        // Fetch direct shared tasks matching peer ID or group visibility
        const peerEvents = db.prepare(`
            SELECT * FROM tasks
            WHERE deleted = 0 
              AND (visibility = 'shared_group' 
                   OR (visibility = 'shared_specific' AND shared_with LIKE ?))
        `).all(`%"${peerId}"%`);

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

        // Fetch Milestones associated with this peer
        details.milestones = db.prepare(`
            SELECT * FROM shared_milestones 
            WHERE peer_id = ? AND deleted = 0 
            ORDER BY target_date DESC, created_at DESC
        `).all(peerId);

        // Fetch Shared Memories associated with this peer
        details.sharedMemories = db.prepare(`
            SELECT * FROM shared_memories 
            WHERE peer_id = ?
            ORDER BY created_at DESC
        `).all(peerId);

    } catch (e) {
        console.error("continuityThreads: Failed to fetch thread details:", e.message);
    }

    return details;
}

/**
 * Add a shared activity mapping
 */
function addSharedActivity(peerId, activityType, targetId) {
    const id = mainDb.generateUUID();
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO shared_activities (id, relationship_id, activity_type, target_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, peerId, activityType, targetId, now, now);
        return { success: true };
    } catch (e) {
        console.error("continuityThreads: Failed to map shared activity:", e.message);
        return { success: false, error: e.message };
    }
}

// Ensure schema columns
try { db.prepare("ALTER TABLE relationships ADD COLUMN phone TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE relationships ADD COLUMN avatar_url TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE relationships ADD COLUMN country TEXT").run(); } catch(e) {}

/**
 * Add a new continuity thread connection (Peer / Person)
 */
function addThread(userId, name, role, email, peerUserId, phone = null, avatarUrl = null, country = null) {
    const id = mainDb.generateUUID();
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO relationships (id, user_id, name, role, created_at, updated_at, peer_user_id, peer_email, phone, avatar_url, country)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, name, role, now, now, peerUserId || null, email || null, phone || null, avatarUrl || null, country || null);
        
        // Log first contact interaction
        logInteraction(id, 'conversation');
        
        return { success: true, id };
    } catch (e) {
        console.error("continuityThreads: Failed to add thread:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Edit an existing continuity thread (Peer / Person)
 */
function editThread(userId, personId, name, role, email, phone = null, avatarUrl = null, country = null) {
    const now = Date.now();
    try {
        db.prepare(`
            UPDATE relationships 
            SET name = ?, role = ?, peer_email = ?, phone = ?, avatar_url = ?, country = ?, updated_at = ?
            WHERE id = ? AND (user_id = ? OR user_id IS NULL)
        `).run(name, role, email || null, phone || null, avatarUrl || null, country || null, now, personId, userId);
        return { success: true };
    } catch (e) {
        console.error("continuityThreads: Failed to edit thread:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Remove a continuity thread (Peer / Person)
 * Preserves message history and call records while removing relationship mapping
 */
function removeThread(userId, personId) {
    try {
        const transaction = db.transaction(() => {
            db.prepare(`DELETE FROM shared_activities WHERE relationship_id = ?`).run(personId);
            db.prepare(`DELETE FROM shared_milestones WHERE peer_id = ?`).run(personId);
            db.prepare(`DELETE FROM relationship_interactions WHERE peer_id = ?`).run(personId);
            db.prepare(`DELETE FROM continuity_metrics WHERE peer_id = ?`).run(personId);
            db.prepare(`DELETE FROM relationships WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(personId, userId);
        });
        transaction();
        return { success: true };
    } catch (e) {
        console.error("continuityThreads: Failed to remove thread:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Log an interaction with a peer
 */
function logInteraction(peerId, type) {
    const id = mainDb.generateUUID();
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO relationship_interactions (id, peer_id, interaction_type, timestamp)
            VALUES (?, ?, ?, ?)
        `).run(id, peerId, type || 'conversation', now);
        
        // Recompute metrics
        computeContinuityMetrics(peerId);
        return { success: true };
    } catch (e) {
        console.error("continuityThreads: Failed to log interaction:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Shared Milestone CRUD Actions
 */
function getSharedMilestones(peerId) {
    try {
        if (!peerId) {
            // Get all user milestones (both personal and peer connected ones)
            return db.prepare("SELECT * FROM shared_milestones WHERE deleted = 0 ORDER BY target_date DESC").all();
        } else {
            return db.prepare("SELECT * FROM shared_milestones WHERE peer_id = ? AND deleted = 0 ORDER BY target_date DESC").all(peerId);
        }
    } catch (e) {
        console.error("continuityThreads: Failed to fetch shared milestones:", e.message);
        return [];
    }
}

function addSharedMilestone({ title, description, targetDate, peerId, projectId, goalId, importanceScore }) {
    const id = 'ms_' + Math.random().toString(36).substring(2, 11);
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO shared_milestones (
                id, title, description, target_date, peer_id, 
                project_id, goal_id, status, importance_score, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
        `).run(
            id,
            title,
            description || '',
            targetDate || new Date().toISOString().split('T')[0],
            peerId || null,
            projectId || null,
            goalId || null,
            importanceScore || 5,
            now,
            now
        );

        if (peerId) {
            // Log interaction as shared goal milestone creation
            logInteraction(peerId, 'shared_goal');
            // Recompute
            computeContinuityMetrics(peerId);
        }

        return { success: true, milestoneId: id };
    } catch (e) {
        console.error("continuityThreads: Failed to add milestone:", e.message);
        return { success: false, error: e.message };
    }
}

function completeMilestone(milestoneId) {
    const now = Date.now();
    try {
        db.prepare(`
            UPDATE shared_milestones 
            SET status = 'completed', updated_at = ?
            WHERE id = ? AND deleted = 0
        `).run(now, milestoneId);

        // Fetch milestone to recompute peer metrics if applicable
        const ms = db.prepare("SELECT peer_id FROM shared_milestones WHERE id = ?").get(milestoneId);
        if (ms && ms.peer_id) {
            computeContinuityMetrics(ms.peer_id);
        }

        return { success: true };
    } catch (e) {
        console.error("continuityThreads: Failed to complete milestone:", e.message);
        return { success: false, error: e.message };
    }
}

function deleteMilestone(milestoneId) {
    const now = Date.now();
    try {
        db.prepare(`
            UPDATE shared_milestones 
            SET deleted = 1, updated_at = ?
            WHERE id = ?
        `).run(now, milestoneId);

        // Fetch milestone to recompute peer metrics
        const ms = db.prepare("SELECT peer_id FROM shared_milestones WHERE id = ?").get(milestoneId);
        if (ms && ms.peer_id) {
            computeContinuityMetrics(ms.peer_id);
        }

        return { success: true };
    } catch (e) {
        console.error("continuityThreads: Failed to delete milestone:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Schedule a joint study session in task list and link to peer
 */
async function scheduleJointSession(peerId, title, date, startTime, durationMin) {
    const taskUuid = mainDb.generateUUID();
    const seedTime = Date.now();
    const deviceId = mainDb.getDeviceId();

    try {
        // Insert task with 'shared_specific' visibility and map to peer
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, visibility, shared_with)
            VALUES (?, ?, ?, 'study', 0, ?, ?, ?, ?, 0, 0, 'shared_specific', ?)
        `).run(taskUuid, title, date, startTime, durationMin, seedTime, deviceId, JSON.stringify([peerId]));

        // Link in shared activities
        db.prepare(`
            INSERT INTO shared_activities (id, relationship_id, activity_type, target_id, created_at, updated_at)
            VALUES (?, ?, 'event', ?, ?, ?)
        `).run(mainDb.generateUUID(), peerId, taskUuid, seedTime, seedTime);

        // Log interaction as study session scheduled
        logInteraction(peerId, 'study');

        // Fetch peer to see if we can share on Supabase
        const peer = db.prepare("SELECT * FROM relationships WHERE id = ?").get(peerId);

        // Ensure study calendar exists locally
        const studyCal = db.prepare("SELECT * FROM calendars WHERE id = 'study'").get();
        if (!studyCal) {
            const authUserId = mainDb.getSyncMeta('auth_user_id') || 'local_user';
            db.prepare(`
                INSERT INTO calendars (id, name, owner_id, layer_type, updated_at, device_id)
                VALUES ('study', 'Study Calendar', ?, ?, ?)
            `).run(authUserId, seedTime, deviceId);
        }

        const useCloud = mainDb.getSyncMeta('use_cloud') !== 'false';
        const authUserId = mainDb.getSyncMeta('auth_user_id');
        const authToken = mainDb.getSyncMeta('auth_token');
        const cloudDb = require('./cloudDb');

        if (cloudDb && authUserId && authToken && useCloud) {
            // Ensure study calendar is on Supabase
            await cloudDb.from('calendars').upsert({
                id: 'study',
                name: 'Study Calendar',
                owner_id: authUserId,
                layer_type: 'shared',
                updated_at: seedTime,
                device_id: deviceId
            });

            // Owner member
            await cloudDb.from('calendar_members').upsert({
                calendar_id: 'study',
                user_id: authUserId,
                role: 'owner',
                updated_at: seedTime,
                device_id: deviceId
            });

            // Share with peer on Supabase if they have peer_user_id
            if (peer && peer.peer_user_id) {
                await cloudDb.from('calendar_members').upsert({
                    calendar_id: 'study',
                    user_id: peer.peer_user_id,
                    role: 'editor',
                    updated_at: seedTime,
                    device_id: deviceId
                });
            }

            // Insert joint session event
            await cloudDb.from('events').upsert({
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
        }

        return { success: true, taskId: taskUuid };
    } catch (e) {
        console.error("continuityThreads: Failed to schedule joint session:", e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    getThreads,
    getThreadDetails,
    addSharedActivity,
    addThread,
    editThread,
    removeThread,
    logInteraction,
    getSharedMilestones,
    addSharedMilestone,
    completeMilestone,
    deleteMilestone,
    scheduleJointSession
};
