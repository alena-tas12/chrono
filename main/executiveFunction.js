const mainDb = require('./main_db');

/**
 * 🧠 EXECUTIVE FUNCTION COACH ENGINE
 * Monitors task deadlines, identifies slipped tasks, and constructs
 * proactive, shame-free rescheduling structures (cognitive scaffolding).
 */

function getSlippedTasks(currentDate) {
    const db = mainDb.db;
    const today = currentDate || new Date().toISOString().split('T')[0];

    try {
        // Query tasks scheduled before today that are not completed and not deleted
        const slipped = db.prepare(`
            SELECT * FROM tasks 
            WHERE date < ? AND completed = 0 AND deleted = 0
            ORDER BY date ASC, updated_at DESC
        `).all(today);

        if (slipped.length === 0) {
            return {
                hasSlipped: false,
                slippedTasks: [],
                proposal: null
            };
        }

        // Generate shame-free move proposal actions
        const actions = slipped.map(task => ({
            type: 'move',
            taskId: task.id,
            text: task.text,
            originalDate: task.date,
            newDate: today
        }));

        const taskNames = slipped.map(t => `"${t.text}"`).join(', ');

        return {
            hasSlipped: true,
            slippedTasks: slipped,
            proposal: {
                type: 'slipped_reschedule',
                confidence: 0.88,
                reason: 'Active tasks scheduled in the past detected as incomplete.',
                explanation: `I noticed that these tasks: ${taskNames} are still active from earlier days. There is absolutely no shame in shifting things around. Shall we slide them all onto today's focus queue?`,
                reasoning_bullets: [
                    "Tasks remained incomplete after their scheduled date",
                    "Cognitive anchoring recommendation to prevent task neglect",
                    "Shame-free schedule restructuring support"
                ],
                actions
            }
        };
    } catch (e) {
        console.error("ExecutiveFunction: Failed to query slipped tasks:", e.message);
        return {
            hasSlipped: false,
            slippedTasks: [],
            proposal: null
        };
    }
}

module.exports = {
    getSlippedTasks
};
