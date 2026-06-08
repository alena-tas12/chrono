const mainDb = require('./main_db');
const db = mainDb.db;
const cloudDb = require('./cloudDb');

/**
 * Context Resurrection Service
 * Compiles state differences, open loops, and peer milestones completed since the user's last session.
 */
async function getContextResurrection(userId = 'local_user') {
    const now = Date.now();
    const lastActiveStr = mainDb.getSyncMeta('last_active_time');
    const userName = mainDb.getSyncMeta('user_name') || 'Planner';
    
    let elapsedDays = 0;
    let lastActiveTime = now;
    if (lastActiveStr) {
        lastActiveTime = parseInt(lastActiveStr, 10) || now;
        elapsedDays = Math.round((now - lastActiveTime) / (1000 * 60 * 60 * 24));
    }
    
    // 1. Fetch Decayed Study Subjects (last_recalled > 5 days ago)
    const fiveDaysAgo = now - 5 * 86400000;
    const decayedSubjects = [];
    try {
        const rows = db.prepare(`
            SELECT s.name, m.mastery, m.last_recalled
            FROM subjects s
            JOIN subject_mastery m ON s.id = m.subject_id
            WHERE m.last_recalled < ? OR m.last_recalled IS NULL
        `).all(fiveDaysAgo);
        rows.forEach(r => {
            decayedSubjects.push(r.name);
        });
    } catch (e) {
        console.error("Resurrection: Failed to fetch decayed subjects:", e.message);
    }

    // 2. Fetch Open Loops (cognitive_loops where status = 'active' or 'no_new_development')
    const openLoops = [];
    try {
        const rows = db.prepare("SELECT topic, revisited_count FROM cognitive_loops WHERE status = 'active' OR status = 'no_new_development' ORDER BY revisited_count DESC LIMIT 3").all();
        rows.forEach(r => {
            openLoops.push(r.topic);
        });
    } catch (e) {
        console.error("Resurrection: Failed to fetch open loops:", e.message);
    }

    // 3. Fetch Completed Milestones since last session (local SQLite first)
    const completedMilestones = [];
    try {
        const rows = db.prepare("SELECT title, peer_id FROM shared_milestones WHERE status = 'completed' AND updated_at > ?").all(lastActiveTime);
        rows.forEach(r => {
            let peerName = 'a peer';
            if (r.peer_id) {
                const peerRow = db.prepare("SELECT name FROM relationships WHERE id = ?").get(r.peer_id);
                if (peerRow) peerName = peerRow.name;
            }
            completedMilestones.push(`"${r.title}" (completed by ${peerName})`);
        });
    } catch (e) {
        console.error("Resurrection: Failed to fetch local milestones:", e.message);
    }

    // Fetch Completed Milestones from Supabase Cloud if connected
    const useCloud = mainDb.getSyncMeta('use_cloud') !== 'false';
    const authToken = mainDb.getSyncMeta('auth_token');
    if (cloudDb && authToken && useCloud) {
        try {
            const { data, error } = await cloudDb
                .from('shared_milestones')
                .select('title, peer_id')
                .eq('status', 'completed')
                .gt('updated_at', new Date(lastActiveTime).toISOString());
            if (!error && data && data.length > 0) {
                for (const item of data) {
                    const exists = completedMilestones.some(m => m.includes(item.title));
                    if (!exists) {
                        let peerName = 'a peer';
                        if (item.peer_id) {
                            const peerRow = db.prepare("SELECT name FROM relationships WHERE id = ?").get(item.peer_id);
                            if (peerRow) peerName = peerRow.name;
                        }
                        completedMilestones.push(`"${item.title}" (completed by ${peerName})`);
                    }
                }
            }
        } catch (e) {
            console.warn("Could not fetch remote milestones on resurrection:", e.message || e);
        }
    }

    // Load Cognitive State (Thinking phase & Focus Profile)
    let activePhase = "Deep Focus / Spaced Learning";
    let activeProfileLabel = "Adaptive Pacing";
    try {
        const activeProfileRow = db.prepare("SELECT value FROM memory_behavior WHERE type = 'active_profile' ORDER BY timestamp DESC LIMIT 1").get();
        if (activeProfileRow) {
            const labelMap = {
                architect: "Systems Architect (layered, analytical focus)",
                companion: "Guided Scaffold (relational support pacing)",
                adaptive: "Adaptive Pacing (dynamic focus adaptation)",
                observer: "Neutral Observer (coherence telemetry and patterns)"
            };
            activeProfileLabel = labelMap[activeProfileRow.value] || activeProfileLabel;
        }

        // Infer active thinking phase from the most common category of active projects or tasks
        const activeProjectRow = db.prepare("SELECT title FROM projects WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1").get();
        if (activeProjectRow) {
            activePhase = `sprint focus on "${activeProjectRow.title}"`;
        }
    } catch(e) {
        console.error("Resurrection: Failed to infer cognitive state:", e.message);
    }

    // 4. Synthesize Story-Oriented Narrative Greeting
    let greetingText = `Welcome back, ${userName}. `;
    if (elapsedDays > 0) {
        greetingText += `Restoring your persistent context after a ${elapsedDays}-day period of absence. `;
    } else {
        greetingText += `Re-anchoring your active focus. `;
    }

    greetingText += `You are currently returning to your cognitive phase of: ${activePhase}, operating under the ${activeProfileLabel} layer.\n\n`;

    let storyNarrative = '';
    if (completedMilestones.length > 0) {
        storyNarrative += `While you were away, the collaborative landscape evolved: peers finalized key milestones, including ${completedMilestones.join(', ')}. `;
    }
    if (decayedSubjects.length > 0) {
        storyNarrative += `Inside your learning chapters, retention decay has been detected for ${decayedSubjects.join(', ')}. We should prioritize active recall sessions to stabilize these mastery traces. `;
    }
    if (openLoops.length > 0) {
        storyNarrative += `Additionally, you have unresolved cognitive loops on: ${openLoops.join(', ')}. `;
    }

    if (storyNarrative.length > 0) {
        greetingText += `Current Chapter Status:\n${storyNarrative}`;
    } else {
        greetingText += `All collaborative projects, milestones, and focus chapters remain stable and in alignment.`;
    }

    return {
        elapsedDays,
        decayedSubjects,
        openLoops,
        completedMilestones,
        greeting: greetingText
    };
}

module.exports = {
    getContextResurrection
};
