const mainDb = require('./main_db');

/**
 * 📝 REFLECTION ENGINE
 * Synthesizes chronological timelines, emotional trends, and habit streaks 
 * into narrative anchors. Persists summaries to cognitive_memories.
 */

function generateDailyReflection(userId, dateKey) {
    const db = mainDb.db;
    const todayStr = dateKey || new Date().toISOString().split('T')[0];
    const deviceId = mainDb.getDeviceId();
    const now = Date.now();

    // Timestamps for start and end of the day in UTC so dateKey matches ISO date strings reliably.
    const startOfDay = Date.parse(`${todayStr}T00:00:00Z`);
    const endOfDay = Date.parse(`${todayStr}T23:59:59Z`);

    try {
        // 1. Fetch completed tasks for today
        const completedTasks = db.prepare(`
            SELECT * FROM tasks 
            WHERE date = ? AND completed = 1 AND deleted = 0
        `).all(todayStr);

        // 2. Fetch pending tasks for today
        const pendingTasks = db.prepare(`
            SELECT * FROM tasks 
            WHERE date = ? AND completed = 0 AND deleted = 0
        `).all(todayStr);

        // 3. Fetch chat logs for today
        const chatLogs = db.prepare(`
            SELECT * FROM memory_chat 
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp ASC
        `).all(startOfDay, endOfDay);

        // 4. Summarize emotional states from chat history
        const emotions = [];
        chatLogs.forEach(chat => {
            // Simple keyword-based emotional extraction as fallback
            const lower = (chat.user_input || '').toLowerCase();
            if (lower.includes('tired') || lower.includes('exhausted')) emotions.push('tired');
            else if (lower.includes('stressed') || lower.includes('anxious') || lower.includes('panic')) emotions.push('overwhelmed');
            else if (lower.includes('happy') || lower.includes('excited') || lower.includes('great')) emotions.push('energetic');
            else emotions.push('calm');
        });

        const baselineEmotion = emotions.length > 0 
            ? emotions.reduce((acc, curr) => (acc[curr] = (acc[curr] || 0) + 1, acc), {})
            : { calm: 1 };
        
        const primaryEmotion = Object.keys(baselineEmotion).reduce((a, b) => baselineEmotion[a] > baselineEmotion[b] ? a : b, 'calm');

        // 5. Structure timeline nodes
        const timeline = [];
        
        // Add tasks to timeline
        completedTasks.forEach(task => {
            timeline.push({
                time: task.start_time || '12:00',
                type: 'task_completed',
                text: `Completed task: "${task.text}"`,
                category: task.calendar || 'personal'
            });
        });

        pendingTasks.forEach(task => {
            timeline.push({
                time: task.start_time || '17:00',
                type: 'task_pending',
                text: `Still pending: "${task.text}"`,
                category: task.calendar || 'personal'
            });
        });

        // Add chats to timeline
        chatLogs.forEach(chat => {
            const timeStr = new Date(chat.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            timeline.push({
                time: timeStr,
                type: 'chat',
                text: `Exchanged thoughts: "${chat.user_input.substring(0, 40)}..."`,
                response: chat.ai_response.substring(0, 45) + '...'
            });
        });

        // Sort timeline chronologically
        timeline.sort((a, b) => a.time.localeCompare(b.time));

        // Create narrative summary text
        const completedCount = completedTasks.length;
        const totalCount = completedCount + pendingTasks.length;
        const taskRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        let narrative = `Today was a day characterized by ${primaryEmotion} feelings. You completed ${completedCount} out of ${totalCount} scheduled tasks.`;
        if (taskRate >= 80) {
            narrative += " Your focus execution was exceptional! You cleared almost all target anchors.";
        } else if (taskRate >= 50) {
            narrative += " You kept up solid momentum, keeping your focus blocks balanced.";
        } else if (totalCount > 0) {
            narrative += " It was a day with slower momentum. Remember, rest is just as productive as study.";
        } else {
            narrative += " The calendar was open. You allowed yourself breathing room.";
        }

        const reflectionData = {
            date: todayStr,
            narrative,
            taskCompletionRate: taskRate,
            primaryEmotion,
            timeline
        };

        // 6. Save or Update in cognitive_memories SQLite table
        const id = 'rec_' + todayStr.replace(/-/g, '_');
        db.prepare(`
            INSERT OR REPLACE INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, 'daily_reflection', JSON.stringify(reflectionData), 5, now, now, deviceId, 0, 0);

        console.log(`✅ reflectionEngine: Synthesized daily reflection for ${todayStr}.`);
        return reflectionData;
    } catch (e) {
        console.error("reflectionEngine: Failed to generate daily reflection:", e.message);
        return null;
    }
}

function getDailyReflections(userId) {
    const db = mainDb.db;
    try {
        const rows = db.prepare(`
            SELECT * FROM cognitive_memories 
            WHERE user_id = ? AND memory_type = 'daily_reflection' AND deleted = 0
            ORDER BY created_at DESC 
            LIMIT 30
        `).all(userId);

        return rows.map(r => {
            const data = JSON.parse(r.content);
            data.id = r.id; // pass actual memory id for references
            return data;
        });
    } catch (e) {
        console.error("reflectionEngine: Failed to fetch daily reflections:", e.message);
        return [];
    }
}

function editReflection(userId, dateKey, newNarrative) {
    const db = mainDb.db;
    const now = Date.now();
    const id = 'rec_' + dateKey.replace(/-/g, '_');

    try {
        const row = db.prepare("SELECT content FROM cognitive_memories WHERE id = ?").get(id);
        if (!row) return { success: false, error: 'Reflection not found' };

        const reflectionData = JSON.parse(row.content);
        reflectionData.narrative = newNarrative;

        db.prepare(`
            UPDATE cognitive_memories 
            SET content = ?, updated_at = ?, synced = 0
            WHERE id = ?
        `).run(JSON.stringify(reflectionData), now, id);

        return { success: true, content: reflectionData };
    } catch (e) {
        console.error("reflectionEngine: Failed to edit reflection:", e.message);
        return { success: false, error: e.message };
    }
}

function deleteReflection(userId, dateKey) {
    const db = mainDb.db;
    const now = Date.now();
    const id = 'rec_' + dateKey.replace(/-/g, '_');

    try {
        db.prepare(`
            UPDATE cognitive_memories 
            SET deleted = 1, updated_at = ?, synced = 0
            WHERE id = ?
        `).run(now, id);
        return { success: true };
    } catch (e) {
        console.error("reflectionEngine: Failed to delete reflection:", e.message);
        return { success: false, error: e.message };
    }
}

function pruneAndConsolidateReflections(userId) {
    const db = mainDb.db;
    const now = Date.now();
    const cutoff = now - 7 * 86400000; // 7 days ago
    const pruneCutoff = now - 14 * 86400000; // 14 days ago

    try {
        const oldReflections = db.prepare(`
            SELECT * FROM cognitive_memories 
            WHERE user_id = ? AND memory_type = 'daily_reflection' AND created_at < ? AND deleted = 0
        `).all(userId, cutoff);

        if (oldReflections.length >= 5) {
            console.log(`📦 reflectionEngine: Consolidating ${oldReflections.length} daily reflections into a weekly summary.`);
            
            const narratives = [];
            let totalCompletion = 0;
            const emotions = {};

            oldReflections.forEach(row => {
                const data = JSON.parse(row.content);
                narratives.push(`• ${data.date}: ${data.narrative}`);
                totalCompletion += (data.taskCompletionRate || 0);
                if (data.primaryEmotion) {
                    emotions[data.primaryEmotion] = (emotions[data.primaryEmotion] || 0) + 1;
                }
            });

            const avgCompletion = Math.round(totalCompletion / oldReflections.length);
            const weeklyEmotion = Object.keys(emotions).reduce((a, b) => emotions[a] > emotions[b] ? a : b, 'calm');

            const weeklyData = {
                type: 'weekly_consolidation',
                consolidatedRange: `${JSON.parse(oldReflections[oldReflections.length - 1].content).date} to ${JSON.parse(oldReflections[0].content).date}`,
                narrative: `Weekly Growth Summary:\n${narratives.join('\n')}`,
                taskCompletionRate: avgCompletion,
                primaryEmotion: weeklyEmotion,
                timeline: []
            };

            const weeklyId = `weekly_${Date.now()}`;
            db.prepare(`
                INSERT INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted)
                VALUES (?, ?, 'weekly_reflection', ?, 7, ?, ?, ?, 0, 0)
            `).run(weeklyId, userId, JSON.stringify(weeklyData), now, now, mainDb.getDeviceId());

            // Soft delete raw entries older than 14 days to prevent UI/sync bloat
            db.prepare(`
                UPDATE cognitive_memories 
                SET deleted = 1, updated_at = ?
                WHERE user_id = ? AND memory_type = 'daily_reflection' AND created_at < ?
            `).run(now, userId, pruneCutoff);

            console.log("✅ Weekly consolidation complete. Old daily records pruned.");
        }
    } catch (e) {
        console.error("reflectionEngine: Failed to consolidate reflections:", e.message);
    }
}

module.exports = {
    generateDailyReflection,
    getDailyReflections,
    editReflection,
    deleteReflection,
    pruneAndConsolidateReflections
};
