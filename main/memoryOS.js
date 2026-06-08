const mainDb = require('./main_db');
const db = mainDb.db;

/**
 * Calculate Significance Score: (Importance * Impact) / (delta_t + 1) * Frequency
 */
function calculateSignificance(memory, now = Date.now()) {
    const importance = memory.importance_score || 5;
    const impact = memory.impact_score || 5;
    const createdAt = memory.created_at || memory.timestamp || now;
    const deltaDays = Math.max(0, (now - createdAt) / 86400000);
    
    // Frequency metric: occurrences of the subject or key keywords
    let frequency = 1;
    try {
        if (memory.subject_id) {
            const subjTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE subject_id = ?").get(memory.subject_id);
            frequency += (subjTasks ? subjTasks.count : 0);
        } else if (memory.text || memory.title) {
            const text = memory.text || memory.title;
            const words = text.split(/\s+/).filter(w => w.length > 4);
            if (words.length > 0) {
                const param = `%${words[0]}%`;
                const similar = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE text LIKE ?").get(param);
                frequency += (similar ? similar.count : 0);
            }
        }
    } catch (e) {}

    return ((importance * impact) / (deltaDays + 1)) * frequency;
}

/**
 * Helper to get the previous month key
 */
function getPreviousMonth(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

/**
 * Helper to get the top subject name and count for a month
 */
function getTopSubjectForMonth(yearMonth) {
    try {
        const tasks = db.prepare(`
            SELECT s.name as subject_name, COUNT(*) as count
            FROM tasks t
            JOIN subjects s ON t.subject_id = s.id
            WHERE t.completed = 1 AND t.deleted = 0 AND t.date LIKE ?
            GROUP BY s.name
            ORDER BY count DESC
            LIMIT 1
        `).get(`${yearMonth}%`);
        return tasks ? { name: tasks.subject_name, count: tasks.count } : null;
    } catch (e) {
        return null;
    }
}

/**
 * Consolidate monthly raw study activities into themes
 */
function consolidateActivity(userId, yearMonth) {
    try {
        const tasks = db.prepare(`
            SELECT t.text, t.calendar, t.date, t.duration_min, s.name as subject_name
            FROM tasks t
            LEFT JOIN subjects s ON t.subject_id = s.id
            WHERE t.completed = 1 AND t.deleted = 0 AND t.date LIKE ?
        `).all(`${yearMonth}%`);

        const subjectCounts = {};
        tasks.forEach(t => {
            if (t.subject_name) {
                subjectCounts[t.subject_name] = (subjectCounts[t.subject_name] || 0) + 1;
            }
        });

        const summaries = [];
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthNum = parseInt(yearMonth.split('-')[1], 10);
        const monthName = months[monthNum - 1] || 'the month';

        // 1. Alert if subject count >= 5
        Object.entries(subjectCounts).forEach(([subj, count]) => {
            if (count >= 5) {
                summaries.push(`"${subj}" became a major focus during ${monthName} (completed ${count} sessions).`);
            }
        });

        // 2. Study focus transition delta
        const currTop = getTopSubjectForMonth(yearMonth);
        const prevMonth = getPreviousMonth(yearMonth);
        const prevTop = getTopSubjectForMonth(prevMonth);
        if (currTop && prevTop && currTop.name !== prevTop.name && currTop.count >= 3 && prevTop.count >= 3) {
            summaries.push(`Academic priorities transitioned from ${prevTop.name} to ${currTop.name}.`);
        }

        if (summaries.length === 0) {
            if (tasks.length > 0) {
                summaries.push(`Maintained a steady routine with ${tasks.length} tasks completed during ${monthName}.`);
            } else {
                summaries.push(`No significant study activity recorded for ${monthName}.`);
            }
        }

        return summaries.join(' ');
    } catch (e) {
        console.error("Failed to consolidate activity:", e.message);
        return "Steady progress recorded.";
    }
}

/**
 * Month-over-month Identity Timeline ("Who am I becoming?") narrative compiler
 */
function getIdentityTimeline(userId, yearMonth) {
    try {
        const [year, month] = yearMonth.split('-').map(Number);
        const startTime = new Date(year, month - 1, 1).getTime();
        const endTime = new Date(year, month, 1).getTime();

        // 1. Dominated calendar layers
        const tasks = db.prepare(`
            SELECT calendar, COUNT(*) as count 
            FROM tasks 
            WHERE completed = 1 AND deleted = 0 AND date LIKE ?
            GROUP BY calendar
        `).all(`${yearMonth}%`);

        let totalTasks = 0;
        let studyCount = 0;
        let personalCount = 0;
        tasks.forEach(t => {
            totalTasks += t.count;
            if (t.calendar === 'study' || t.calendar === 'focus') studyCount += t.count;
            if (t.calendar === 'personal') personalCount += t.count;
        });

        let style = 'Balanced Integration';
        if (totalTasks > 0) {
            if (studyCount / totalTasks >= 0.6) {
                style = 'Academic Growth';
            } else if (personalCount / totalTasks >= 0.6) {
                style = 'Personal Continuity';
            }
        }

        // 2. Stress check in notes
        const notes = db.prepare(`
            SELECT title, content FROM notes 
            WHERE created_at >= ? AND created_at < ?
        `).all(startTime, endTime);

        let stressCount = 0;
        const stressWords = ['stress', 'anxious', 'tired', 'burnout', 'overwhelmed', 'exhausted', 'worry'];
        let noteSubjects = new Set();
        
        notes.forEach(n => {
            const text = `${n.title} ${n.content || ''}`.toLowerCase();
            stressWords.forEach(w => {
                if (text.includes(w)) stressCount++;
            });
            
            ['dsa', 'calculus', 'physics', 'math', 'discrete', 'chemistry'].forEach(sub => {
                if (text.includes(sub)) noteSubjects.add(sub.toUpperCase());
            });
        });

        let stressFocus = "";
        if (stressCount >= 2) {
            style = 'Recovery & Resilience Focus';
            stressFocus = " Mindfulness and fatigue management became vital.";
        }

        // 3. Peak focus window info
        let focusNarrative = "";
        try {
            const cognitiveProfile = require('./cognitiveProfile');
            const prof = cognitiveProfile.getCognitiveProfile(userId);
            if (prof && prof.best_focus_time) {
                focusNarrative = ` Protected peak focus window around ${prof.best_focus_time}.`;
            }
        } catch(err) {}

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = months[month - 1] || 'Unknown';

        let subjectsText = "";
        if (noteSubjects.size > 0) {
            subjectsText = ` with deep dives into ${Array.from(noteSubjects).join(', ')}`;
        }

        return `${monthName} ${year}: Characterized by a dominant theme of ${style}${subjectsText}.${focusNarrative}${stressFocus}`;

    } catch (e) {
        console.error("Failed to compute identity timeline:", e.message);
        return "Steady state with positive development patterns.";
    }
}

/**
 * Compile Monthly Memory Cards
 * Aggregates study session durations, task completions, goal counts, and chats.
 */
function getMemoryCards(userId) {
    const cards = [];
    try {
        // Fetch all completed tasks with dates to aggregate
        const tasks = db.prepare(`
            SELECT date, calendar, duration_min 
            FROM tasks 
            WHERE completed = 1 AND deleted = 0
        `).all();

        // Fetch all created goals
        const goals = db.prepare(`
            SELECT created_at, title 
            FROM goals
        `).all();

        // Fetch chats
        const chats = db.prepare(`
            SELECT timestamp, user_input 
            FROM memory_chat
        `).all();

        // Group by Year-Month (e.g. "2026-05")
        const monthlyGroups = {};

        // Process tasks
        tasks.forEach(t => {
            if (!t.date) return;
            const monthKey = t.date.substring(0, 7); // "YYYY-MM"
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = {
                    studyHours: 0,
                    tasksCompleted: 0,
                    goalsCreated: [],
                    milestones: [],
                    interactions: 0
                };
            }
            monthlyGroups[monthKey].tasksCompleted++;
            if (t.calendar === 'study' || t.calendar === 'focus') {
                monthlyGroups[monthKey].studyHours += (t.duration_min || 60) / 60.0;
            }
        });

        // Process goals
        goals.forEach(g => {
            const date = new Date(g.created_at);
            const monthKey = date.toISOString().split('T')[0].substring(0, 7);
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = {
                    studyHours: 0,
                    tasksCompleted: 0,
                    goalsCreated: [],
                    milestones: [],
                    interactions: 0
                };
            }
            monthlyGroups[monthKey].goalsCreated.push(g.title);
        });

        // Process chats for interaction counts & milestones
        chats.forEach(c => {
            if (!c.timestamp) return;
            const monthKey = new Date(c.timestamp).toISOString().split('T')[0].substring(0, 7);
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = {
                    studyHours: 0,
                    tasksCompleted: 0,
                    goalsCreated: [],
                    milestones: [],
                    interactions: 0
                };
            }
            monthlyGroups[monthKey].interactions++;
            // Check if chat represents a key conversation milestone
            const inputLower = c.user_input.toLowerCase();
            if (inputLower.includes('princess') || inputLower.includes('exam') || inputLower.includes('study')) {
                if (monthlyGroups[monthKey].milestones.length < 3) {
                    let desc = '';
                    if (inputLower.includes('princess')) desc = 'Conversation with Princess';
                    else if (inputLower.includes('exam')) desc = `Prep for ${inputLower.match(/(\w+\s+exam|exam\s+\w+)/)?.[0] || 'Exam'}`;
                    else desc = 'Study session scheduling';
                    
                    if (!monthlyGroups[monthKey].milestones.includes(desc)) {
                        monthlyGroups[monthKey].milestones.push(desc);
                    }
                }
            }
        });

        // Format into list of month cards
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        for (const [key, val] of Object.entries(monthlyGroups)) {
            const [year, monthNum] = key.split('-');
            const monthName = months[parseInt(monthNum, 10) - 1] || 'Unknown';
            
            // Consolidate monthly themes & identity narratives
            const consolidationText = consolidateActivity(userId, key);
            const identityNarrative = getIdentityTimeline(userId, key);

            cards.push({
                monthKey: key,
                title: `${monthName} ${year}`,
                studyHours: Math.round(val.studyHours * 10) / 10,
                tasksCompleted: val.tasksCompleted,
                goalsCreated: val.goalsCreated,
                milestones: val.milestones.length > 0 ? val.milestones : ['Routine planning session'],
                consolidationText,
                identityNarrative
            });
        }

        // Sort chronologically descending
        cards.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    } catch (e) {
        console.error("Failed to generate memory cards:", e.message);
    }
    return cards;
}

/**
 * Search Memories across chats, notes, and tasks
 */
function searchMemories(userId, query) {
    const results = [];
    if (!query || !query.trim()) return results;
    const searchPattern = `%${query.trim()}%`;
    const now = Date.now();

    try {
        // 1. Search Notes
        const notes = db.prepare(`
            SELECT id, title, content, created_at, importance_score, impact_score, linked_subject_id as subject_id, 'note' as type 
            FROM notes 
            WHERE title LIKE ? OR content LIKE ?
        `).all(searchPattern, searchPattern);
        
        notes.forEach(n => {
            const significance = calculateSignificance({ ...n, timestamp: n.created_at }, now);
            results.push({
                id: n.id,
                title: `📝 Note: ${n.title}`,
                content: n.content || '',
                date: new Date(n.created_at).toLocaleDateString(),
                timestamp: n.created_at,
                type: 'note',
                significance
            });
        });

        // 2. Search Tasks
        const tasks = db.prepare(`
            SELECT id, text, date, calendar, completed, importance_score, impact_score, subject_id, 'task' as type 
            FROM tasks 
            WHERE text LIKE ? AND deleted = 0
        `).all(searchPattern);
        
        tasks.forEach(t => {
            const timestamp = new Date(t.date).getTime();
            const significance = calculateSignificance({ ...t, timestamp }, now);
            results.push({
                id: t.id,
                title: `📅 Task: ${t.text}`,
                content: `Calendar: ${t.calendar} | Status: ${t.completed ? 'Completed' : 'Pending'}`,
                date: t.date,
                timestamp,
                type: 'task',
                significance
            });
        });

        // 3. Search Chat History
        const chats = db.prepare(`
            SELECT id, user_input, ai_response, timestamp, 'chat' as type 
            FROM memory_chat 
            WHERE user_input LIKE ? OR ai_response LIKE ?
        `).all(searchPattern, searchPattern);
        
        chats.forEach(c => {
            const significance = calculateSignificance({ ...c, importance_score: 5, impact_score: 5 }, now);
            results.push({
                id: c.id,
                title: `🧠 Chat: "${c.user_input.substring(0, 30)}..."`,
                content: `AI: ${c.ai_response}`,
                date: new Date(c.timestamp).toLocaleDateString(),
                timestamp: c.timestamp,
                type: 'chat',
                significance
            });
        });

        // Sort by Significance score descending
        results.sort((a, b) => b.significance - a.significance);

    } catch (e) {
        console.error("Failed to execute memory search:", e.message);
    }
    return results;
}

/**
 * Tokenize and find contextually linked notes, goals, or tasks
 */
function getLinkedMemories(userId, text) {
    const linked = { notes: [], goals: [], tasks: [] };
    if (!text || !text.trim()) return linked;

    const tokens = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 4); // Only search for longer meaningful words

    if (tokens.length === 0) return linked;

    try {
        // Query goals matching any of these tokens
        const goalQuery = `SELECT * FROM goals WHERE ` + tokens.map(() => `title LIKE ? OR description LIKE ?`).join(' OR ');
        const goalParams = [];
        tokens.forEach(t => {
            goalParams.push(`%${t}%`, `%${t}%`);
        });

        linked.goals = db.prepare(goalQuery).all(...goalParams);

        // Query notes
        const noteQuery = `SELECT * FROM notes WHERE ` + tokens.map(() => `title LIKE ? OR content LIKE ?`).join(' OR ');
        const noteParams = [];
        tokens.forEach(t => {
            noteParams.push(`%${t}%`, `%${t}%`);
        });
        linked.notes = db.prepare(noteQuery).all(...noteParams);

        // Query tasks
        const taskQuery = `SELECT * FROM tasks WHERE deleted = 0 AND (` + tokens.map(() => `text LIKE ?`).join(' OR ') + `)`;
        const taskParams = tokens.map(t => `%${t}%`);
        linked.tasks = db.prepare(taskQuery).all(...taskParams);

    } catch (e) {
        console.error("Failed to get linked memories:", e.message);
    }

    return linked;
}

function getLifeContinuity(userId) {
    const data = {
        whatMattered: [],
        whatChanged: [],
        whatForgetting: [],
        whoMatters: [],
        whatProgress: [],
        whatFocusNext: ""
    };

    try {
        // 1. What Mattered: High importance memories & Active goals
        const activeGoals = db.prepare("SELECT title, target_date FROM goals WHERE status = 'active' LIMIT 3").all();
        activeGoals.forEach(g => {
            data.whatMattered.push(`🎯 Goal: ${g.title} (Target: ${g.target_date || 'None'})`);
        });
        const memories = db.prepare("SELECT content FROM cognitive_memories WHERE memory_type = 'daily_reflection' ORDER BY created_at DESC LIMIT 2").all();
        memories.forEach(m => {
            try {
                const parsed = JSON.parse(m.content);
                if (parsed.journalEntry) {
                    data.whatMattered.push(`💭 Logged: "${parsed.journalEntry.substring(0, 50)}..."`);
                }
            } catch(err) {}
        });

        // 2. What Changed: Mastery score deltas
        const masteryList = db.prepare(`
            SELECT s.name, m.mastery 
            FROM subjects s
            JOIN subject_mastery m ON s.id = m.subject_id
            ORDER BY m.mastery DESC LIMIT 3
        `).all();
        masteryList.forEach(m => {
            data.whatChanged.push(`📚 Mastery in "${m.name}" is now at ${Math.round(m.mastery * 100)}%`);
        });

        // 3. What Am I Forgetting: Slipped tasks & study gaps
        const slipped = db.prepare("SELECT text, date FROM tasks WHERE completed = 0 AND deleted = 0 AND date < ? LIMIT 2").all(new Date().toISOString().split('T')[0]);
        slipped.forEach(s => {
            data.whatForgetting.push(`⚠️ Slipped: "${s.text}" (Missed: ${s.date})`);
        });
        // Study gap checking
        const studyGaps = db.prepare(`
            SELECT s.name, m.last_recalled 
            FROM subjects s
            LEFT JOIN subject_mastery m ON s.id = m.subject_id
            ORDER BY m.last_recalled ASC LIMIT 2
        `).all();
        studyGaps.forEach(g => {
            if (g.last_recalled) {
                const diffDays = Math.round((Date.now() - g.last_recalled) / 86400000);
                if (diffDays >= 5) {
                    data.whatForgetting.push(`⏰ Focus Gap: haven't reviewed "${g.name}" in ${diffDays} days`);
                }
            } else {
                data.whatForgetting.push(`⏰ Focus Gap: "${g.name}" has not been practiced yet`);
            }
        });

        // 4. Who Matters: Peers with interaction counts
        const peers = db.prepare("SELECT * FROM relationships LIMIT 3").all();
        peers.forEach(p => {
            const count = db.prepare("SELECT COUNT(*) as count FROM shared_activities WHERE relationship_id = ?").get(p.id);
            data.whoMatters.push(`${p.display_picture || '👤'} ${p.name} (${p.role}) — ${count ? count.count : 0} shared events/goals`);
        });

        // 5. What Progress: Aggregated hours & tasks
        const totalCompleted = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND deleted = 0").get();
        const totalStudyMinutes = db.prepare("SELECT SUM(duration_min) as total FROM tasks WHERE completed = 1 AND deleted = 0 AND calendar = 'study'").get();
        const hrs = totalStudyMinutes && totalStudyMinutes.total ? Math.round(totalStudyMinutes.total / 60) : 0;
        data.whatProgress.push(`✅ Task Completions: ${totalCompleted ? totalCompleted.count : 0} tasks completed in total`);
        data.whatProgress.push(`⏳ Active Study Time: ${hrs} hours accumulated`);

        // 6. What Should I Focus On Next: study coach recommendation
        const lowestMastery = db.prepare(`
            SELECT s.name, m.mastery 
            FROM subjects s
            JOIN subject_mastery m ON s.id = m.subject_id
            ORDER BY m.mastery ASC LIMIT 1
        `).get();
        if (lowestMastery) {
            data.whatFocusNext = `We recommend reviewing "${lowestMastery.name}" (current mastery is lowest at ${Math.round(lowestMastery.mastery * 100)}%).`;
        } else {
            data.whatFocusNext = "No active subject anchors found. Map a DSA topic under Goals to get started!";
        }

    } catch (e) {
        console.error("Failed to compile Life Continuity dashboard stats:", e.message);
    }
    return data;
}

module.exports = {
    getMemoryCards,
    searchMemories,
    getLinkedMemories,
    getLifeContinuity,
    calculateSignificance,
    consolidateActivity,
    getIdentityTimeline
};
