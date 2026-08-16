const mainDb = require('./main_db');
const db = mainDb.db;

/**
 * 1. Cognitive Fronts Monitor
 * Evaluates activity densities to track active & high-load fronts.
 */
function getCognitiveFronts(userId = 'local_user') {
    const activeFronts = [];
    let highLoadFrontsCount = 0;
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];

    try {
        const tasks = db.prepare(`
            SELECT calendar, goal_id, project_id, text, visibility 
            FROM tasks 
            WHERE date >= ? AND deleted = 0
        `).all(sevenDaysAgo);

        const counts = {
            Academic: 0,
            Project: 0,
            Relationship: 0,
            Health: 0,
            Personal: 0
        };

        tasks.forEach(t => {
            const cal = (t.calendar || 'personal').toLowerCase();
            const text = (t.text || '').toLowerCase();
            
            if (cal === 'study' || cal === 'focus') {
                counts.Academic++;
            }
            if (t.goal_id || t.project_id || cal === 'project') {
                counts.Project++;
            }
            if (cal === 'family' || t.visibility === 'shared_specific' || t.visibility === 'shared_group') {
                counts.Relationship++;
            }
            if (cal === 'routine') {
                counts.Health++;
            }
            if (cal === 'personal') {
                counts.Personal++;
            }
        });

        Object.entries(counts).forEach(([front, count]) => {
            if (count > 0) {
                const isHigh = count >= 8;
                if (isHigh) highLoadFrontsCount++;
                activeFronts.push({
                    name: front,
                    loadScore: count,
                    status: isHigh ? 'High Load' : 'Active'
                });
            }
        });

    } catch (e) {
        console.error("Failed to get cognitive fronts:", e.message);
    }

    return {
        activeFronts,
        highLoadFrontsCount
    };
}

/**
 * 2. Expansion vs Completion Monitor
 * Computes Creation Rate vs Completion Rate.
 */
function getExpansionMetrics(userId = 'local_user') {
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgoTime = now - 30 * 86400000;

    let createdCount = 0;
    let completedCount = 0;
    let risk = 'Low';

    try {
        // Query tasks created in last 30 days
        // (Since tasks.updated_at is updated on edit, we look at created_at if we had it,
        // or approximate by tasks with date in last 30 days)
        const totalTasks30 = db.prepare(`
            SELECT completed FROM tasks 
            WHERE date >= ? AND deleted = 0
        `).all(thirtyDaysAgo);

        createdCount = totalTasks30.length;
        completedCount = totalTasks30.filter(t => t.completed === 1).length;

        // Query new projects
        const newProj = db.prepare("SELECT COUNT(*) as count FROM projects WHERE created_at >= ?").get(thirtyDaysAgoTime);
        createdCount += (newProj ? newProj.count : 0);

        const ratio = createdCount / (completedCount + 1);
        if (ratio >= 3.0) {
            risk = 'High';
        } else if (ratio >= 1.5) {
            risk = 'Moderate';
        }

    } catch (e) {
        console.error("Failed to get expansion metrics:", e.message);
    }

    return {
        createdCount,
        completedCount,
        expansionRisk: risk
    };
}

/**
 * 3. Relationship Continuity Meter
 * Calculates active shared events/goals to reconcile perceived state with actual state.
 */
function getRelationshipContinuity(userId = 'local_user') {
    const list = [];
    try {
        const peers = db.prepare("SELECT * FROM relationships WHERE user_id = ?").all(userId);
        peers.forEach(peer => {
            const countRow = db.prepare("SELECT COUNT(*) as count FROM shared_activities WHERE relationship_id = ?").get(peer.id);
            const count = countRow ? countRow.count : 0;
            
            // Shared Goals count
            const goalsRow = db.prepare("SELECT COUNT(*) as count FROM shared_activities WHERE relationship_id = ? AND activity_type = 'goal'").get(peer.id);
            const sharedGoalsCount = goalsRow ? goalsRow.count : 0;

            // Frequency: Interactions in database last 30 days
            const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            const interactionRow = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE date >= ? AND text LIKE ? AND completed = 1").get(thirtyDaysAgo, `%${peer.name}%`);
            const frequency = interactionRow ? interactionRow.count : 0;

            // Reciprocity (ratio of tasks scheduled by user vs shared - mock metric or simple ratio)
            const reciprocity = frequency > 0 ? (frequency >= 3 ? 'Balanced' : 'Receiving') : 'Initiating';

            // Continuity Trend: growing or declining based on interaction frequency changes
            const prev30 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
            const prevRow = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE date >= ? AND date < ? AND text LIKE ? AND completed = 1").get(prev30, thirtyDaysAgo, `%${peer.name}%`);
            const prevFrequency = prevRow ? prevRow.count : 0;

            let continuityTrend = 'Stable';
            if (frequency > prevFrequency) {
                continuityTrend = 'Growing';
            } else if (frequency < prevFrequency && frequency < 2) {
                continuityTrend = 'Declining';
            }

            let status = 'Low Interaction';
            if (count >= 5 || frequency >= 4) {
                status = 'Active';
            } else if (count >= 2 || frequency >= 1) {
                status = 'Moderate';
            }

            list.push({
                name: peer.name,
                role: peer.role,
                sharedCount: count,
                sharedGoalsCount,
                frequency,
                reciprocity,
                continuityTrend,
                status
            });
        });
    } catch(e) {
        console.error("Failed to get relationship continuity:", e.message);
    }
    return list;
}

/**
 * 4. Meaning vs Activity Engine
 * Highlights meaningful milestones (high significance completions).
 */
function getMeaningfulMilestones(userId = 'local_user') {
    const milestones = [];
    try {
        // High importance tasks completed
        const tasks = db.prepare(`
            SELECT text, date, calendar FROM tasks 
            WHERE completed = 1 AND deleted = 0 AND importance_score >= 7
            ORDER BY date DESC LIMIT 5
        `).all();

        tasks.forEach(t => {
            milestones.push(`Meaningful Milestone: Completed "${t.text}" on ${t.date} (${t.calendar} focus).`);
        });

        // High importance notes
        const notes = db.prepare(`
            SELECT title, created_at FROM notes 
            WHERE importance_score >= 7 
            ORDER BY created_at DESC LIMIT 5
        `).all();

        notes.forEach(n => {
            const dateStr = new Date(n.created_at).toLocaleDateString();
            milestones.push(`Meaningful Thought: Captured "${n.title}" on ${dateStr}.`);
        });

    } catch (e) {
        console.error("Failed to get meaningful milestones:", e.message);
    }
    return milestones;
}

/**
 * 5. Loop Detector & Continuity Intervention Engine
 * Detects keywords repeated in notes, tasks, or chats and classifies loop status/resolution action.
 */
function getLoopDetections(userId = 'local_user') {
    const detections = [];
    try {
        const notes = db.prepare("SELECT title, content FROM notes").all();
        const chats = db.prepare("SELECT user_input FROM memory_chat").all();

        const wordsFreq = {};
        const stopWords = new Set(['about', 'their', 'there', 'would', 'could', 'should', 'today', 'tomorrow', 'yesterday', 'study', 'focus', 'notes', 'tasks', 'needs', 'style', 'class', 'const', 'where', 'select', 'where']);

        const processText = (text) => {
            if (!text) return;
            const words = text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 4 && !stopWords.has(w));
            
            // Unique words per document to track document frequency
            const unique = new Set(words);
            unique.forEach(w => {
                wordsFreq[w] = (wordsFreq[w] || 0) + 1;
            });
        };

        notes.forEach(n => processText(`${n.title} ${n.content || ''}`));
        chats.forEach(c => processText(c.user_input));

        const now = Date.now();
        Object.entries(wordsFreq).forEach(([word, freq]) => {
            if (freq >= 5) {
                const topic = word.charAt(0).toUpperCase() + word.slice(1);
                
                // Insert or update DB loop state
                const existing = db.prepare("SELECT * FROM cognitive_loops WHERE topic = ?").get(topic);
                if (existing) {
                    db.prepare("UPDATE cognitive_loops SET revisited_count = ?, updated_at = ? WHERE topic = ?")
                      .run(freq, now, topic);
                } else {
                    db.prepare("INSERT INTO cognitive_loops (topic, revisited_count, status, resolution_action, updated_at) VALUES (?, ?, 'no_new_development', 'continue_reflection', ?)")
                      .run(topic, freq, now);
                }
            }
        });

        // Read back from DB to return complete list including user statuses
        const rows = db.prepare("SELECT * FROM cognitive_loops WHERE revisited_count >= 5 AND status != 'archived' ORDER BY revisited_count DESC").all();
        rows.forEach(r => {
            detections.push({
                topic: r.topic,
                revisitedCount: r.revisited_count,
                status: r.status,
                resolutionAction: r.resolution_action,
                promptText: `You have revisited "${r.topic.toLowerCase()}" ${r.revisited_count} times. Status: ${r.status}. Action: ${r.resolution_action}.`
            });
        });

    } catch (e) {
        console.error("Loop detector failed:", e.message);
    }
    return detections;
}

function resolveLoopIntervention(topic, status, action) {
    try {
        db.prepare("UPDATE cognitive_loops SET status = ?, resolution_action = ?, updated_at = ? WHERE topic = ?")
          .run(status, action, Date.now(), topic);

        // Log loop resolution event in the adherence tracking table
        const id = 'ad_' + Math.random().toString(36).substring(2, 11);
        db.prepare(`
            INSERT INTO cognitive_loop_adherence (id, topic, action, date_resolved, completed_review)
            VALUES (?, ?, ?, ?, 0)
        `).run(id, topic, action, Date.now());

        if (action === 'schedule_review') {
            const mainDb = require('./main_db');
            const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            mainDb.addTask({
                text: `Review Repeating Topic: ${topic}`,
                date: tomorrowStr,
                calendar: 'focus',
                duration_min: 45
            });
        }
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

function getInterventionAdherence(userId = 'local_user') {
    try {
        const totalRow = db.prepare("SELECT COUNT(*) as count FROM cognitive_loop_adherence").get();
        const completedRow = db.prepare("SELECT COUNT(*) as count FROM cognitive_loop_adherence WHERE completed_review = 1").get();
        
        const total = totalRow ? totalRow.count : 0;
        const completed = completedRow ? completedRow.count : 0;
        const ratio = total > 0 ? parseFloat((completed / total).toFixed(2)) : 1.0;
        
        return {
            totalInterventions: total,
            completedReviews: completed,
            adherenceRatio: ratio,
            adherencePercentage: Math.round(ratio * 100)
        };
    } catch (err) {
        console.error("Failed to calculate intervention adherence:", err.message);
        return {
            totalInterventions: 0,
            completedReviews: 0,
            adherenceRatio: 1.0,
            adherencePercentage: 100
        };
    }
}

/**
 * 6. Memory Compression Engine
 * Group items into core universal themes.
 */
function getMemoryCompressionThemes(userId = 'local_user') {
    const themes = {
        Learning: [],
        Relationships: [],
        Projects: [],
        Health: [],
        Growth: []
    };

    try {
        // Learning: subjects and mastery
        const subjects = db.prepare(`
            SELECT s.name, m.mastery 
            FROM subjects s
            JOIN subject_mastery m ON s.id = m.subject_id
            ORDER BY m.mastery DESC LIMIT 3
        `).all();
        subjects.forEach(s => {
            themes.Learning.push(`Mastery in ${s.name} reached ${Math.round(s.mastery * 100)}%`);
        });

        // Relationships: active peer checkins
        const peers = db.prepare("SELECT name, role FROM relationships LIMIT 3").all();
        peers.forEach(p => {
            themes.Relationships.push(`Collaborated with ${p.name} (${p.role})`);
        });

        // Projects: active goals/projects
        const activeGoals = db.prepare("SELECT title FROM goals WHERE status = 'active' LIMIT 3").all();
        activeGoals.forEach(g => {
            themes.Projects.push(`Active Anchor: ${g.title}`);
        });

        // Health: routine tasks completed
        const routines = db.prepare(`
            SELECT text FROM tasks 
            WHERE calendar = 'routine' AND completed = 1 AND deleted = 0 
            LIMIT 3
        `).all();
        routines.forEach(r => {
            themes.Health.push(`Maintained: ${r.text}`);
        });

        // Growth: daily reflection logs
        const reflections = db.prepare(`
            SELECT content FROM cognitive_memories 
            WHERE memory_type = 'daily_reflection' AND deleted = 0 
            ORDER BY created_at DESC LIMIT 2
        `).all();
        reflections.forEach(ref => {
            try {
                const parsed = JSON.parse(ref.content);
                themes.Growth.push(parsed.narrative);
            } catch(e) {}
        });

    } catch (e) {
        console.error("Failed memory compression engine:", e.message);
    }
    return themes;
}

/**
 * 7. Deep Focus Monitor
 * Checks focus duration depth.
 */
function getDeepFocusStats(userId = 'local_user') {
    try {
        const completedFocus = db.prepare(`
            SELECT text, duration_min, date 
            FROM tasks 
            WHERE completed = 1 AND deleted = 0 AND calendar = 'focus' 
            ORDER BY date DESC LIMIT 3
        `).all();
        return completedFocus;
    } catch(e) {
        return [];
    }
}

/**
 * 8. Values Alignment Layer
 * Matches completed tasks count with core value parameters.
 */
function getValuesAlignment(userId = 'local_user') {
    const alignment = [];
    try {
        const tasks = db.prepare("SELECT calendar, COUNT(*) as count FROM tasks WHERE completed = 1 AND deleted = 0 GROUP BY calendar").all();
        let total = 0;
        const counts = {};
        tasks.forEach(t => {
            total += t.count;
            counts[t.calendar] = t.count;
        });

        const defaultValues = [
            { name: 'Learning', calendars: ['study', 'focus'] },
            { name: 'Family', calendars: ['family'] },
            { name: 'Career & Projects', calendars: ['project'] },
            { name: 'Health & Mindfulness', calendars: ['routine'] }
        ];

        defaultValues.forEach(val => {
            let valCount = 0;
            val.calendars.forEach(c => {
                valCount += (counts[c] || 0);
            });
            const alignmentScore = total > 0 ? Math.round((valCount / total) * 100) : 0;
            alignment.push({
                value: val.name,
                alignmentScore,
                priorityStatus: alignmentScore >= 40 ? 'High Alignment' : 'Neutral'
            });
        });

    } catch (e) {
        console.error("Values alignment failed:", e.message);
    }
    return alignment;
}

/**
 * 9. Weekly Continuity Audit
 * Returns continuity audit vectors.
 */
function getWeeklyAudit(userId = 'local_user') {
    const audit = {
        whatMattered: [],
        whatChanged: [],
        whatProgressed: [],
        whatStalled: [],
        whatPreserved: [],
        whatReleased: []
    };

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];

    try {
        // What Mattered: Completed tasks with importance >= 7
        const mattered = db.prepare(`
            SELECT text FROM tasks 
            WHERE completed = 1 AND deleted = 0 AND importance_score >= 7 AND date >= ?
        `).all(sevenDaysAgo);
        audit.whatMattered = mattered.map(m => m.text);

        // What Changed: Mastery changes in last 7 days
        const changed = db.prepare(`
            SELECT s.name, m.mastery 
            FROM subjects s
            JOIN subject_mastery m ON s.id = m.subject_id
            WHERE m.mastery > 0.1
            LIMIT 3
        `).all();
        audit.whatChanged = changed.map(c => `Mastered "${c.name}" to ${Math.round(c.mastery * 100)}%`);

        // What Progressed: Completed tasks linked to active projects/goals
        const progressed = db.prepare(`
            SELECT text FROM tasks 
            WHERE completed = 1 AND deleted = 0 AND goal_id IS NOT NULL AND date >= ?
        `).all(sevenDaysAgo);
        audit.whatProgressed = progressed.map(p => p.text);

        // What Stalled: Overdue/slipped tasks (pending tasks with date < today)
        const todayStr = new Date().toISOString().split('T')[0];
        const stalled = db.prepare(`
            SELECT text, date FROM tasks 
            WHERE completed = 0 AND deleted = 0 AND date < ?
        `).all(todayStr);
        audit.whatStalled = stalled.map(s => `Overdue: "${s.text}" (scheduled ${s.date})`);

        // What Preserved: Routines completed in last 7 days
        const preserved = db.prepare(`
            SELECT text FROM tasks 
            WHERE calendar = 'routine' AND completed = 1 AND deleted = 0 AND date >= ?
        `).all(sevenDaysAgo);
        audit.whatPreserved = preserved.map(p => p.text);

        // What Released: Goals completed or inactive
        const released = db.prepare(`
            SELECT title FROM goals WHERE status = 'completed' OR status = 'released'
        `).all();
        audit.whatReleased = released.map(r => r.title);

    } catch (e) {
        console.error("Weekly audit compilation failed:", e.message);
    }
    return audit;
}

/**
 * 10. Communication Assistant
 * Evaluates complexity, emotional intensity, and length of user draft entries.
 */
function evaluateDraftCommunication(text) {
    if (!text || !text.trim()) {
        return { rating: 'Empty', action: 'N/A' };
    }
    const len = text.length;
    const wordCount = text.split(/\s+/).length;

    // Intensity keywords
    const intensityWords = ['urgent', 'must', 'angry', 'terrible', 'hate', 'stupid', 'love', 'fantastic', 'essential', 'immediately', 'fail', 'bad', 'wrong'];
    let intensityCount = 0;
    intensityWords.forEach(w => {
        const matches = text.toLowerCase().match(new RegExp(`\\b${w}\\b`, 'g'));
        if (matches) intensityCount += matches.length;
    });

    let action = 'Send';
    let emotionalIntensity = 'Calm';

    if (intensityCount >= 3) {
        emotionalIntensity = 'High';
        action = 'Save Draft & Re-read';
    } else if (intensityCount >= 1) {
        emotionalIntensity = 'Moderate';
    }

    if (len > 800) {
        action = 'Compress or Convert to Note';
    } else if (wordCount > 60 && action === 'Send') {
        action = 'Compress';
    }

    return {
        characterCount: len,
        wordCount,
        emotionalIntensity,
        action
    };
}

/**
 * 11. Continuity State Machine
 */
function getContinuityState(userId = 'local_user') {
    let state = 'Maintaining';
    let explanation = 'Stable cycle. Routine and project outputs are balanced.';
    
    try {
        const now = Date.now();
        const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
        
        const newProj = db.prepare("SELECT COUNT(*) as count FROM projects WHERE created_at >= ?").get(now - 7 * 86400000);
        const newProjCount = newProj ? newProj.count : 0;
        
        const studySec = db.prepare("SELECT SUM(duration_min) as total FROM tasks WHERE completed = 1 AND deleted = 0 AND date >= ? AND (calendar = 'study' OR calendar = 'focus')").get(sevenDaysAgo);
        const studyMin = studySec && studySec.total ? studySec.total : 0;
        
        const pendingCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND deleted = 0").get().count;
        
        const fronts = getCognitiveFronts(userId);
        const highLoad = fronts.highLoadFrontsCount;

        const notesCount = db.prepare("SELECT COUNT(*) as count FROM notes WHERE created_at >= ?").get(now - 7 * 86400000).count;

        if (highLoad >= 2 || pendingCount >= 15) {
            state = 'Overloaded';
            explanation = 'High load signals across multiple fronts. Action recommended: defer tasks and enter focus block pacing.';
        } else if (newProjCount >= 2 && studyMin >= 120) {
            state = 'Building';
            explanation = 'Elevated creation and execution velocity. Protecting peak slots is high priority.';
        } else if (notesCount >= 4 && newProjCount >= 1) {
            state = 'Exploring';
            explanation = 'Generative phase with increased conceptual note connections and values research.';
        } else if (studyMin === 0 && pendingCount <= 5) {
            state = 'Recovering';
            explanation = 'Low execution density. Prioritizing routine preservation and cognitive decompression.';
        }
        
        db.prepare("DELETE FROM memory_behavior WHERE type = 'continuity_state'").run();
        db.prepare("INSERT INTO memory_behavior (type, value, timestamp) VALUES ('continuity_state', ?, ?)").run(state, now);
        
    } catch(e) {
        console.error("State machine failed:", e.message);
    }
    
    return { state, explanation };
}

/**
 * 12. Configurable Fronts
 */
function getConfigurableFronts() {
    try {
        return db.prepare("SELECT * FROM cognitive_front_categories").all();
    } catch(e) {
        return [];
    }
}

function updateFrontCategory(id, active) {
    try {
        db.prepare("UPDATE cognitive_front_categories SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

/**
 * 13. Memory Preservation Scores
 */
function getMemoryPreservationScores(userId = 'local_user') {
    const list = [];
    try {
        const tasks = db.prepare("SELECT id, text as title, 'task' as type, preservation_state FROM tasks WHERE deleted = 0 LIMIT 15").all();
        const notes = db.prepare("SELECT id, title, 'note' as type, preservation_state FROM notes LIMIT 15").all();
        
        tasks.forEach(t => {
            list.push({ id: t.id, title: t.title, type: t.type, preservationState: t.preservation_state || 'Archive' });
        });
        notes.forEach(n => {
            list.push({ id: n.id, title: n.title, type: n.type, preservationState: n.preservation_state || 'Archive' });
        });
    } catch(e) {
        console.error("Failed to get preservation scores:", e.message);
    }
    return list;
}

function updateMemoryPreservation(id, type, state) {
    try {
        const table = type === 'note' ? 'notes' : 'tasks';
        db.prepare(`UPDATE ${table} SET preservation_state = ? WHERE id = ?`).run(state, id);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

/**
 * 14. Personal OS Profile
 */
function getPersonalOS(userId = 'local_user') {
    let focusStyle = 'Intervals';
    let planningStyle = 'Daily';
    let reviewStyle = 'Sporadic';
    let peakHours = '09:00-11:00';
    let reflectionFrequency = 'Sporadic';

    try {
        const cognitiveProfile = require('./cognitiveProfile');
        const prof = cognitiveProfile.getCognitiveProfile(userId);
        if (prof) {
            focusStyle = (prof.preferred_session_length || 45) >= 50 ? 'Deep Work' : 'Intervals';
            peakHours = prof.best_focus_time || '09:00-11:00';
        }

        const datesCount = db.prepare("SELECT COUNT(DISTINCT date) as count FROM tasks WHERE deleted = 0").get().count;
        if (datesCount >= 5) {
            planningStyle = 'Weekly';
        }

        const reflections = db.prepare("SELECT COUNT(*) as count FROM cognitive_memories WHERE memory_type = 'daily_reflection' AND deleted = 0").get().count;
        if (reflections >= 4) {
            reflectionFrequency = 'Daily';
            reviewStyle = 'Monthly';
        }

    } catch (e) {
        console.error("Failed to get Personal OS profile:", e.message);
    }

    return {
        focusStyle,
        planningStyle,
        reviewStyle,
        peakHours,
        reflectionFrequency
    };
}

function performBackupRotation() {
    const fs = require('fs');
    const path = require('path');
    try {
        const dbPath = mainDb.dbPath;
        const dbDir = path.dirname(dbPath);
        
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        if (!fs.existsSync(dbPath)) {
            console.warn("Database file does not exist, skipping backup rotation.");
            return;
        }

        const timestamp = Date.now();
        const backupName = `chrono_backup_${timestamp}.db`;
        const backupPath = path.join(dbDir, backupName);

        fs.copyFileSync(dbPath, backupPath);
        console.log(`Backup created: ${backupPath}`);

        const files = fs.readdirSync(dbDir);
        const backups = files
            .filter(f => f.startsWith('chrono_backup_') && f.endsWith('.db'))
            .map(f => {
                const parts = f.split('_');
                const tsString = parts[parts.length - 1].replace('.db', '');
                const ts = parseInt(tsString, 10) || 0;
                return { name: f, path: path.join(dbDir, f), ts };
            })
            .sort((a, b) => b.ts - a.ts);

        if (backups.length > 7) {
            const excess = backups.slice(7);
            excess.forEach(b => {
                try {
                    fs.unlinkSync(b.path);
                    console.log(`Deleted stale backup: ${b.name}`);
                } catch (unlinkErr) {
                    console.error(`Failed to delete stale backup ${b.name}:`, unlinkErr.message);
                }
            });
        }
    } catch (err) {
        console.error("Backup rotation failed:", err.message);
    }
}

function checkAndTriggerBackup() {
    try {
        const lastBackup = mainDb.getSyncMeta('last_backup_time');
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        if (!lastBackup || (now - parseInt(lastBackup, 10)) >= oneDayMs) {
            performBackupRotation();
            mainDb.setSyncMeta('last_backup_time', String(now));
        }
    } catch (err) {
        console.error("Failed to check and trigger backup:", err.message);
    }
}

/**
 * 15. Trust & Reliability dashboard metrics
 */
function getTrustReliability(userId = 'local_user') {
    let dataIntegrity = 'Healthy';
    let syncHealth = 'Synched';
    let backupStatus = 'Available';
    let memoryCoverage = 100;
    let readLatencyMs = 0;
    let writeLatencyMs = 0;

    try {
        // Trigger automated backup check
        checkAndTriggerBackup();

        // Measure execution latency of read and write
        const startRead = process.hrtime.bigint();
        db.prepare("SELECT COUNT(*) FROM sync_meta").get();
        const endRead = process.hrtime.bigint();
        readLatencyMs = Number(endRead - startRead) / 1000000;

        const startWrite = process.hrtime.bigint();
        db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('_telemetry_ping', ?)").run(String(Date.now()));
        const endWrite = process.hrtime.bigint();
        writeLatencyMs = Number(endWrite - startWrite) / 1000000;

        const check = db.prepare("PRAGMA integrity_check").get();
        if (check && check.integrity_check !== 'ok') {
            dataIntegrity = 'Compromised';
        }

        const unsyncedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE synced = 0").get().count;
        if (unsyncedTasks > 0) {
            syncHealth = 'Pending Sync';
        }

        const fs = require('fs');
        const path = require('path');
        const dbDir = path.dirname(mainDb.dbPath);
        const files = fs.readdirSync(dbDir);
        const backupExists = files.some(f => f.startsWith('chrono_backup_') && f.endsWith('.db'));
        backupStatus = backupExists ? 'Secured' : 'No Backup Found';

        const totalTasks = db.prepare("SELECT COUNT(*) as count FROM tasks").get().count;
        const totalNotes = db.prepare("SELECT COUNT(*) as count FROM notes").get().count;
        const totalChats = db.prepare("SELECT COUNT(*) as count FROM memory_chat").get().count;
        const indexedCount = totalTasks + totalNotes + totalChats;
        memoryCoverage = Math.min(100, Math.max(10, indexedCount * 5));

    } catch(e) {
        console.error("Trust dashboard compilation failed:", e.message);
    }

    return {
        dataIntegrity,
        syncHealth,
        backupStatus,
        memoryCoverage,
        readLatencyMs: parseFloat(readLatencyMs.toFixed(2)),
        writeLatencyMs: parseFloat(writeLatencyMs.toFixed(2))
    };
}

/**
 * 16. Human Continuity Index
 */
function getContinuityIndex(userId = 'local_user') {
    let goalsScore = 50;
    let relationshipsScore = 50;
    let learningScore = 50;
    let healthScore = 50;
    let valuesScore = 50;
    let reflectionScore = 50;

    try {
        const completedGoals = db.prepare("SELECT COUNT(*) as count FROM goals WHERE status = 'completed'").get().count;
        const totalGoals = db.prepare("SELECT COUNT(*) as count FROM goals").get().count;
        goalsScore = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 50;

        const peers = getRelationshipContinuity(userId);
        const activePeers = peers.filter(p => p.status === 'Active' || p.status === 'Moderate').length;
        relationshipsScore = peers.length > 0 ? Math.round((activePeers / peers.length) * 100) : 50;

        const masteries = db.prepare("SELECT mastery FROM subject_mastery").all();
        if (masteries.length > 0) {
            const sum = masteries.reduce((acc, curr) => acc + curr.mastery, 0);
            learningScore = Math.round((sum / masteries.length) * 100);
        }

        const totalRoutines = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE calendar = 'routine'").get().count;
        const completedRoutines = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE calendar = 'routine' AND completed = 1").get().count;
        healthScore = totalRoutines > 0 ? Math.round((completedRoutines / totalRoutines) * 100) : 50;

        const values = getValuesAlignment(userId);
        const alignedCount = values.filter(v => v.priorityStatus === 'High Alignment').length;
        valuesScore = values.length > 0 ? Math.round((alignedCount / values.length) * 100) : 50;

        const reflectionDays = db.prepare("SELECT COUNT(*) as count FROM cognitive_memories WHERE memory_type = 'daily_reflection' AND deleted = 0").get().count;
        reflectionScore = Math.min(100, reflectionDays * 20);

    } catch (e) {
        console.error("Continuity Index failed:", e.message);
    }

    const subScores = {
        goals: Math.max(10, goalsScore),
        relationships: Math.max(10, relationshipsScore),
        learning: Math.max(10, learningScore),
        health: Math.max(10, healthScore),
        values: Math.max(10, valuesScore),
        reflection: Math.max(10, reflectionScore)
    };

    const overallIndex = Math.round((subScores.goals + subScores.relationships + subScores.learning + subScores.health + subScores.values + subScores.reflection) / 6);

    return {
        overallIndex,
        subScores
    };
}

/**
 * 17. Narrative Engine
 */
function getMonthlyNarrative(userId = 'local_user') {
    try {
        const now = Date.now();
        const dateStr = new Date(now).toISOString().substring(0, 7);
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthNum = parseInt(dateStr.split('-')[1], 10);
        const monthName = months[monthNum - 1] || 'this month';

        const totalCompleted = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND deleted = 0 AND date LIKE ?").get(`${dateStr}%`).count;
        const totalStudyMinutes = db.prepare("SELECT SUM(duration_min) as total FROM tasks WHERE completed = 1 AND deleted = 0 AND calendar = 'study' AND date LIKE ?").get(`${dateStr}%`).total || 0;
        const studyHrs = Math.round(totalStudyMinutes / 60);

        // Fetch top subjects
        let subjectText = "Academic work progressed across core disciplines.";
        try {
            const tasks = db.prepare(`
                SELECT s.name as subject_name, COUNT(*) as count
                FROM tasks t
                JOIN subjects s ON t.subject_id = s.id
                WHERE t.completed = 1 AND t.deleted = 0 AND t.date LIKE ?
                GROUP BY s.name
                ORDER BY count DESC
                LIMIT 1
            `).get(`${dateStr}%`);
            if (tasks) {
                subjectText = `Study efforts centered around "${tasks.subject_name}" (${tasks.count} focus sessions completed).`;
            }
        } catch(e) {}

        const interactionCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND date LIKE ? AND text LIKE '%Study%'").get(`${dateStr}%`).count;
        const relText = interactionCount > 0 ? "Collaborative study circles stayed stable." : "Relationship checkins thinned slightly this month.";

        return `During ${monthName}, you focused on execution and continuity. You finalized ${totalCompleted} tasks, contributing to ${studyHrs} focused study hours. ${subjectText} ${relText} A major milestone was the completion of Chrono Memory OS.`;
    } catch(e) {
        return "Steady progress was maintained this month. Protected study sessions and key relationship channels remained stable.";
    }
}

module.exports = {
    getCognitiveFronts,
    getExpansionMetrics,
    getRelationshipContinuity,
    getMeaningfulMilestones,
    getLoopDetections,
    resolveLoopIntervention,
    getMemoryCompressionThemes,
    getDeepFocusStats,
    getValuesAlignment,
    getWeeklyAudit,
    evaluateDraftCommunication,
    getContinuityState,
    getConfigurableFronts,
    updateFrontCategory,
    getMemoryPreservationScores,
    updateMemoryPreservation,
    getPersonalOS,
    getTrustReliability,
    getContinuityIndex,
    getMonthlyNarrative,
    performBackupRotation,
    getInterventionAdherence
};
