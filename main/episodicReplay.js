/**
 * 🔁 EPISODIC REPLAY ENGINE
 *
 * Feeds outcomes of completed tasks and events back into the cognitive loop
 * as evidence for future reasoning. This closes the loop between what the user
 * PLANS (tasks) and what actually HAPPENED (episodic outcomes in cognitive_memories).
 *
 * Pipeline:
 *   Completed Task (tasks.completed = 1)
 *       → replayCompletedEpisodes()
 *       → cognitive_memories (memory_type = 'episodic_outcome')
 *       → Dispatch Engine retrieval → System Prompt context
 */

const mainDb = require('./main_db');

/**
 * Scans recently completed tasks and writes them as episodic outcome memories
 * into cognitive_memories. Idempotent — skips tasks already replayed.
 *
 * @param {string} userId - The active user ID (used for DB scoping).
 * @param {number} daysBack - How far back to scan for completed tasks (default 7 days).
 * @returns {{ replayed: number, skipped: number, outcomes: Array }} Summary.
 */
function replayCompletedEpisodes(userId, daysBack = 7) {
    const db = mainDb.db;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffDate = cutoff.toISOString().split('T')[0];

    let replayed = 0;
    let skipped = 0;
    const outcomes = [];

    try {
        // Fetch completed tasks within the window
        const completedTasks = db.prepare(`
            SELECT t.*, g.title as goal_title, s.name as subject_name
            FROM tasks t
            LEFT JOIN goals g ON t.goal_id = g.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            WHERE t.completed = 1 AND t.deleted = 0 AND t.date >= ?
            ORDER BY t.date DESC
        `).all(cutoffDate);

        for (const task of completedTasks) {
            // Check if this episode has already been replayed (avoid duplicates)
            const alreadyReplayed = db.prepare(`
                SELECT id FROM cognitive_memories
                WHERE memory_type = 'episodic_outcome'
                  AND content LIKE ?
                  AND deleted = 0
                LIMIT 1
            `).get(`%task:${task.id}%`);

            if (alreadyReplayed) {
                skipped++;
                continue;
            }

            // Build a rich episodic description
            const contextParts = [`Completed: "${task.text}" on ${task.date}`];
            if (task.subject_name) contextParts.push(`Subject: ${task.subject_name}`);
            if (task.goal_title) contextParts.push(`Goal: ${task.goal_title}`);
            if (task.duration_min && task.duration_min > 0) contextParts.push(`Duration: ${task.duration_min} min`);
            if (task.calendar && task.calendar !== 'personal') contextParts.push(`Calendar: ${task.calendar}`);

            const content = contextParts.join(' | ') + ` [task:${task.id}]`;

            // Write to cognitive_memories as an episodic outcome
            const id = mainDb.generateUUID();
            const now = Date.now();
            db.prepare(`
                INSERT INTO cognitive_memories (
                    id, user_id, memory_type, content, source_type,
                    evidence, confidence, status, importance_score,
                    created_at, updated_at, device_id, synced, deleted
                ) VALUES (?, ?, 'episodic_outcome', ?, 'system_observation',
                          ?, 'high', 'active', 6,
                          ?, ?, ?, 0, 0)
            `).run(
                id,
                userId || mainDb.getActiveUserId() || 'local_user',
                content,
                `Task completed: ${task.text}`,
                now, now,
                mainDb.getDeviceId()
            );

            replayed++;
            outcomes.push({ taskId: task.id, text: task.text, date: task.date });
        }

        console.log(`[EpisodicReplay] Replayed ${replayed} episodes, skipped ${skipped} (already logged).`);
    } catch (e) {
        console.error('[EpisodicReplay] replayCompletedEpisodes failed:', e.message);
    }

    return { replayed, skipped, outcomes };
}

/**
 * Returns a summary of recent episodic outcomes for context injection.
 * Used by the Dispatch Engine to include in retrievedState.episodicReplay.
 *
 * @param {number} limit - Number of recent episodes to return (default 10).
 * @returns {Array} Recent episodic outcome memory rows.
 */
function getEpisodeSummary(limit = 10) {
    const db = mainDb.db;
    try {
        return db.prepare(`
            SELECT content, created_at
            FROM cognitive_memories
            WHERE memory_type = 'episodic_outcome'
              AND status = 'active'
              AND deleted = 0
            ORDER BY created_at DESC
            LIMIT ?
        `).all(limit);
    } catch (e) {
        console.error('[EpisodicReplay] getEpisodeSummary failed:', e.message);
        return [];
    }
}

module.exports = {
    replayCompletedEpisodes,
    getEpisodeSummary
};
