const mainDb = require('./main_db');
const db = mainDb.db;

/**
 * 🧠 COGNITIVE PROFILE ENGINE
 * Analyzes historical tasks and schedules to dynamically compute best focus windows,
 * low-energy slumps, average task duration, and weekday success cycles.
 */

function calculateCognitiveProfile(userId) {
    const now = Date.now();
    const cutoff = now - 14 * 86400000; // Look back 14 days

    // Query tasks updated/created in the last 14 days
    let tasks = [];
    try {
        tasks = db.prepare(`
            SELECT * FROM tasks 
            WHERE updated_at >= ? AND deleted = 0
        `).all(cutoff);
    } catch (e) {
        console.error("cognitiveProfile: Failed to fetch task history:", e.message);
        return null;
    }

    // Group completion densities by hour (0 to 23)
    const completionsByHour = Array(24).fill(0);
    const totalByHour = Array(24).fill(0);

    // Group completion rates by day of week (0 = Sunday, 1 = Monday, ...)
    const completionsByDay = Array(7).fill(0);
    const totalByDay = Array(7).fill(0);

    tasks.forEach(task => {
        if (!task.start_time) return;
        const [hourStr] = task.start_time.split(':');
        const hour = parseInt(hourStr, 10);
        if (isNaN(hour) || hour < 0 || hour > 23) return;

        const dateObj = new Date(task.date);
        const dayOfWeek = dateObj.getDay();

        totalByHour[hour]++;
        totalByDay[dayOfWeek]++;

        if (task.completed === 1) {
            completionsByHour[hour]++;
            completionsByDay[dayOfWeek]++;
        }
    });

    // 1. Calculate best 2-hour focus window
    let bestFocusStart = 9;
    let maxCompletionRate = 0.0;
    for (let i = 0; i < 23; i++) {
        const total = totalByHour[i] + totalByHour[i + 1];
        const completed = completionsByHour[i] + completionsByHour[i + 1];
        const rate = total > 0 ? completed / total : 0.0;
        
        if (rate > maxCompletionRate && total >= 1) {
            maxCompletionRate = rate;
            bestFocusStart = i;
        }
    }

    // 2. Calculate low energy 2-hour window during waking hours (08:00 to 22:00)
    let lowEnergyStart = 16;
    let minCompletionRate = 1.0;
    for (let i = 8; i < 21; i++) {
        const total = totalByHour[i] + totalByHour[i + 1];
        const completed = completionsByHour[i] + completionsByHour[i + 1];
        const rate = total > 0 ? completed / total : 1.0;

        if (rate < minCompletionRate && total >= 1) {
            minCompletionRate = rate;
            lowEnergyStart = i;
        }
    }

    // 3. Compute preferred focus session length (average of completed study/focus blocks)
    const focusDurations = tasks
        .filter(t => t.completed === 1 && (t.calendar === 'study' || t.calendar === 'focus' || t.calendar === 'work'))
        .map(t => t.duration_min);
    
    let preferredLength = 45;
    if (focusDurations.length > 0) {
        const sum = focusDurations.reduce((acc, curr) => acc + curr, 0);
        preferredLength = Math.round(sum / focusDurations.length);
    }

    // Format times as HH:MM strings
    const formatHour = (h) => String(h).padStart(2, '0') + ':00';
    const bestFocusTime = `${formatHour(bestFocusStart)}-${formatHour(bestFocusStart + 2)}`;
    const lowEnergyTime = `${formatHour(lowEnergyStart)}-${formatHour(lowEnergyStart + 2)}`;

    // 4. Calculate day of week success rate
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weeklyRates = {};
    dayNames.forEach((name, idx) => {
        const total = totalByDay[idx];
        const completed = completionsByDay[idx];
        weeklyRates[name] = total > 0 ? Math.round((completed / total) * 100) : 100;
    });

    const stressTriggers = ['overloaded calendar', 'multiple exam overlaps'];

    const profile = {
        user_id: userId,
        best_focus_time: bestFocusTime,
        low_energy_time: lowEnergyTime,
        preferred_session_length: preferredLength,
        stress_triggers: JSON.stringify(stressTriggers),
        weekly_completion_rates: JSON.stringify(weeklyRates),
        updated_at: now
    };

    try {
        db.prepare(`
            INSERT OR REPLACE INTO cognitive_profiles (user_id, best_focus_time, low_energy_time, preferred_session_length, stress_triggers, weekly_completion_rates, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            profile.user_id,
            profile.best_focus_time,
            profile.low_energy_time,
            profile.preferred_session_length,
            profile.stress_triggers,
            profile.weekly_completion_rates,
            profile.updated_at
        );
    } catch (e) {
        console.error("cognitiveProfile: Failed to save computed profile:", e.message);
    }

    return {
        ...profile,
        stress_triggers: stressTriggers,
        weekly_completion_rates: weeklyRates
    };
}

function getCognitiveProfile(userId) {
    try {
        const row = db.prepare("SELECT * FROM cognitive_profiles WHERE user_id = ?").get(userId);
        if (row) {
            return {
                user_id: row.user_id,
                best_focus_time: row.best_focus_time,
                low_energy_time: row.low_energy_time,
                preferred_session_length: row.preferred_session_length,
                stress_triggers: JSON.parse(row.stress_triggers),
                weekly_completion_rates: JSON.parse(row.weekly_completion_rates),
                updated_at: row.updated_at
            };
        }
    } catch (e) {
        console.error("cognitiveProfile: Failed to fetch profile from DB:", e.message);
    }

    // Default profile fallback
    return {
        user_id: userId,
        best_focus_time: "09:00-11:00",
        low_energy_time: "15:00-17:00",
        preferred_session_length: 45,
        stress_triggers: ["overloaded calendar"],
        weekly_completion_rates: {
            sunday: 100, monday: 100, tuesday: 100, wednesday: 100, thursday: 100, friday: 100, saturday: 100
        },
        updated_at: Date.now()
    };
}

module.exports = {
    calculateCognitiveProfile,
    getCognitiveProfile
};
