const mainDb = require('./main_db');
const db = mainDb.db;
const cloudDb = require('./cloudDb');

/**
 * Consolidates monthly highlights and metrics into a yearly narrative digest
 * and saves it as a long-term cognitive memory.
 */
async function consolidateNarrativesToYearly(userId = 'local_user') {
    const currentYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth(); // 0-indexed

    let accumulatedFocusHours = 0;
    let completedTasksTotal = 0;
    const subjectsCount = {};
    const peersCount = {};

    // 1. Fetch and aggregate data for all months of the current year
    for (let m = 0; m <= nowMonth; m++) {
        const monthStr = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
        
        try {
            // Aggregate focus hours
            const focus = db.prepare("SELECT SUM(duration_min) as total FROM tasks WHERE completed = 1 AND deleted = 0 AND calendar = 'focus' AND date LIKE ?").get(`${monthStr}%`);
            accumulatedFocusHours += (focus && focus.total ? focus.total / 60 : 0);

            // Completed tasks
            const completed = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND deleted = 0 AND date LIKE ?").get(`${monthStr}%`);
            completedTasksTotal += (completed ? completed.count : 0);

            // Fetch subjects
            const subj = db.prepare(`
                SELECT s.name, COUNT(*) as count 
                FROM tasks t
                JOIN subjects s ON t.subject_id = s.id
                WHERE t.completed = 1 AND t.deleted = 0 AND t.date LIKE ?
                GROUP BY s.name
            `).all(`${monthStr}%`);
            subj.forEach(s => {
                subjectsCount[s.name] = (subjectsCount[s.name] || 0) + s.count;
            });

            // Fetch peer study tasks
            const studyTasks = db.prepare("SELECT text FROM tasks WHERE completed = 1 AND date LIKE ? AND text LIKE '%Study%'").all(`${monthStr}%`);
            studyTasks.forEach(t => {
                const text = t.text.toLowerCase();
                const peers = ['princess', 'rayhaan', 'sana', 'tara', 'anwesha'];
                peers.forEach(p => {
                    if (text.includes(p)) {
                        peersCount[p] = (peersCount[p] || 0) + 1;
                    }
                });
            });
        } catch (e) {
            console.error(`Error aggregating monthly narrative data for month ${m + 1}:`, e.message);
        }
    }

    // 2. Synthesize themes
    const sortedSubjects = Object.entries(subjectsCount).sort((a, b) => b[1] - a[1]);
    const topSubject = sortedSubjects.length > 0 ? sortedSubjects[0][0] : "Academic Disciplines";

    const sortedPeers = Object.entries(peersCount).sort((a, b) => b[1] - a[1]);
    const topPeer = sortedPeers.length > 0 ? sortedPeers[0][0].charAt(0).toUpperCase() + sortedPeers[0][0].slice(1) : "";

    const focusHoursRound = Math.round(accumulatedFocusHours);
    
    let peerText = "Collaboration channels remained steady throughout the year.";
    if (topPeer) {
        peerText = `Your primary peer collaboration and study focus was with ${topPeer}.`;
    }

    const synthesizedNarrative = `Yearly Digest for ${currentYear}: You demonstrated high consistency and cognitive stability, finalizing ${completedTasksTotal} tasks and logging approximately ${focusHoursRound} focus hours. Deep execution was concentrated within "${topSubject}". ${peerText} Through adaptive memory preservation and active loop intervention reviews, you guarded structural focus and sustained personal growth.`;

    const id = `yearly_narrative_${currentYear}`;
    const now = Date.now();
    const memoryObj = {
        id,
        user_id: userId,
        memory_type: 'yearly_narrative',
        content: JSON.stringify({
            year: currentYear,
            narrative: synthesizedNarrative,
            totalCompletedTasks: completedTasksTotal,
            totalFocusHours: focusHoursRound,
            topSubject,
            topPeer
        }),
        importance_score: 10,
        created_at: now,
        updated_at: now,
        device_id: mainDb.getDeviceId()
    };

    // Save locally
    db.prepare(`
        INSERT OR REPLACE INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced)
        VALUES (?, ?, 'yearly_narrative', ?, ?, ?, ?, ?, 0)
    `).run(id, userId, memoryObj.content, memoryObj.importance_score, now, now, memoryObj.device_id);

    // Save to Supabase Cloud if connected
    const useCloud = mainDb.getSyncMeta('use_cloud') !== 'false';
    const authToken = mainDb.getSyncMeta('auth_token');
    if (cloudDb && authToken && useCloud) {
        try {
            await cloudDb.from('cognitive_memories').insert([{
                id,
                user_id: userId,
                memory_type: 'yearly_narrative',
                content: memoryObj.content,
                importance_score: memoryObj.importance_score,
                created_at: now,
                updated_at: now,
                device_id: memoryObj.device_id,
                synced: 1
            }]);
            console.log("Successfully pushed yearly narrative memory to Supabase cloud.");
        } catch (cloudErr) {
            console.warn("Could not sync yearly narrative to cloud: " + (cloudErr.message || cloudErr));
        }
    }

    return memoryObj;
}

module.exports = {
    consolidateNarrativesToYearly
};
