const mainDb = require('./main_db');
const db = mainDb.db;
const cognitiveProfile = require('./cognitiveProfile');

// Cache to store shown suggestions with timestamps
const cooldownCache = {};
const COOLDOWN_DURATION = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Compiles proactive behavioral suggestions and insights.
 */
function getProactiveSuggestions(userId = 'local_user') {
    const suggestions = [];
    const now = Date.now();

    try {
        const profile = cognitiveProfile.getCognitiveProfile(userId);
        
        let isObserverMode = false;
        try {
            const activeProfileRow = db.prepare("SELECT value FROM memory_behavior WHERE type = 'active_profile' ORDER BY timestamp DESC LIMIT 1").get();
            if (activeProfileRow && activeProfileRow.value === 'observer') {
                isObserverMode = true;
            }
        } catch (e) {
            console.error("jarvisLayer: Failed to check active profile from DB:", e.message);
        }

        if (isObserverMode) {
            const continuityStability = require('./continuityStability');
            const patternParts = [];
            if (profile && profile.best_focus_time) {
                patternParts.push(`Peak completions cluster between ${profile.best_focus_time}.`);
            } else {
                patternParts.push(`Standard waking hours execution.`);
            }
            
            const trendParts = [];
            const fronts = continuityStability.getCognitiveFronts(userId).activeFronts;
            fronts.forEach(f => {
                if (f.status === 'High Load') {
                    trendParts.push(`Front "${f.name}" has shifted to High Load (${f.loadScore} events).`);
                }
            });
            if (trendParts.length === 0) {
                trendParts.push("Cognitive front workload remains stable.");
            }

            const historicalParts = [];
            const loops = continuityStability.getLoopDetections(userId);
            if (loops.length > 0) {
                historicalParts.push(`Topic "${loops[0].topic}" has been revisited ${loops[0].revisitedCount} times (Loop detected).`);
            } else {
                historicalParts.push("Cognitive keyword repetition trends are stable.");
            }

            return [{
                type: 'observer_dashboard',
                text: `Observer Report:\n• Pattern: ${patternParts[0]}\n• Trend: ${trendParts[0]}\n• History: ${historicalParts[0]}`,
                priority: 'normal',
                confidence_score: 1.0,
                importance_score: 7,
                score: 7.0,
                explanation_details: {
                    triggerCondition: "Observation Mode active.",
                    lastEventDate: new Date().toLocaleDateString(),
                    upcomingDeadline: "N/A",
                    recommendation: "N/A (Observation Mode active)"
                },
                observerLayers: {
                    pattern: patternParts[0],
                    trend: trendParts[0],
                    history: historicalParts[0]
                }
            }];
        }

        // 1. Peak focus hours pattern
        if (profile && profile.best_focus_time) {
            const normalText = `You usually focus best from ${profile.best_focus_time}. We should protect this block!`;
            const observerText = `Peak focus completions cluster between ${profile.best_focus_time} (Statistical focus trend).`;

            suggestions.push({
                type: 'focus_pattern',
                text: isObserverMode ? observerText : normalText,
                priority: 'normal',
                confidence_score: 0.9,
                importance_score: 6,
                score: 5.4,
                explanation_details: {
                    triggerCondition: "Detected peak focus hours based on historical task completions.",
                    lastEventDate: "Past 14 days analysis",
                    upcomingDeadline: "N/A",
                    recommendation: isObserverMode ? "N/A (Observation Mode active)" : "Block calendar and set your status to Focus Mode."
                }
            });
        }

        // 2. Study retention gaps (subjects not touched in 5+ days)
        const subjects = db.prepare(`
            SELECT s.id, s.name, m.last_recalled 
            FROM subjects s
            LEFT JOIN subject_mastery m ON s.id = m.subject_id
        `).all();

        for (const subj of subjects) {
            let lastTouched = subj.last_recalled;
            // Also check if any task contains subject name
            const lastTask = db.prepare(`
                SELECT date FROM tasks 
                WHERE text LIKE ? AND completed = 1 AND deleted = 0 
                ORDER BY date DESC LIMIT 1
            `).get(`%${subj.name}%`);

            if (lastTask) {
                const taskTime = new Date(lastTask.date).getTime();
                if (!lastTouched || taskTime > lastTouched) {
                    lastTouched = taskTime;
                }
            }

            if (lastTouched) {
                const diffDays = Math.round((now - lastTouched) / 86400000);
                if (diffDays >= 5) {
                    const normalText = `You haven't touched "${subj.name}" for ${diffDays} days. Shall we schedule a review?`;
                    const observerText = `Recall gap: "${subj.name}" has not been practiced in ${diffDays} days (Retention pattern).`;
                    
                    suggestions.push({
                        type: 'study_gap',
                        text: isObserverMode ? observerText : normalText,
                        priority: 'high',
                        subjectId: subj.id,
                        subjectName: subj.name,
                        confidence_score: 0.8,
                        importance_score: 8,
                        score: 6.4,
                        explanation_details: {
                            triggerCondition: `No study sessions or tasks matching '${subj.name}' recorded in the last ${diffDays} days.`,
                            lastEventDate: new Date(lastTouched).toLocaleDateString(),
                            upcomingDeadline: "N/A",
                            recommendation: isObserverMode ? "N/A (Observation Mode active)" : "Schedule a 45-minute active recall review session today."
                        }
                    });
                }
            } else {
                const normalText = `You haven't initiated active recall for "${subj.name}" yet. Let's schedule unit 1!`;
                const observerText = `Active recall mastery trace for "${subj.name}" is empty (Unstarted subject pattern).`;

                suggestions.push({
                    type: 'study_gap',
                    text: isObserverMode ? observerText : normalText,
                    priority: 'high',
                    subjectId: subj.id,
                    subjectName: subj.name,
                    confidence_score: 0.8,
                    importance_score: 8,
                    score: 6.4,
                    explanation_details: {
                        triggerCondition: `Active recall mastery trace for '${subj.name}' is blank.`,
                        lastEventDate: 'Never',
                        upcomingDeadline: "N/A",
                        recommendation: isObserverMode ? "N/A (Observation Mode active)" : "Seed initial active recall session for Unit 1."
                    }
                });
            }
        }

        // 3. Project age contextual links
        const projects = db.prepare("SELECT * FROM projects WHERE status = 'active'").all();
        projects.forEach(proj => {
            const ageMonths = (now - proj.created_at) / (30 * 86400000);
            if (ageMonths >= 1) { // 1+ months old
                const matchNotes = db.prepare("SELECT id, title FROM notes WHERE linked_project_id = ?").all(proj.id);
                if (matchNotes.length > 0) {
                    const normalText = `Your note "${matchNotes[0].title}" relates to the "${proj.title}" project started ${Math.round(ageMonths)} months ago. Keep pushing!`;
                    const observerText = `Association check: note "${matchNotes[0].title}" links to "${proj.title}" (started ${Math.round(ageMonths)} months ago).`;

                    suggestions.push({
                        type: 'project_context',
                        text: isObserverMode ? observerText : normalText,
                        priority: 'low',
                        confidence_score: 0.7,
                        importance_score: 4,
                        score: 2.8,
                        explanation_details: {
                            triggerCondition: `Active project '${proj.title}' is over ${Math.round(ageMonths)} months old and has linked notes.`,
                            lastEventDate: new Date(proj.created_at).toLocaleDateString(),
                            upcomingDeadline: "N/A",
                            recommendation: isObserverMode ? "N/A (Observation Mode active)" : "Review notes from project kickoff to assess milestones."
                        }
                    });
                }
            }
        });

        // 4. Peer check-ins (Princess study gaps)
        const lastPrincessStudy = db.prepare(`
            SELECT date FROM tasks 
            WHERE text LIKE '%Princess%' AND completed = 1 AND deleted = 0 
            ORDER BY date DESC LIMIT 1
        `).get();

        if (lastPrincessStudy) {
            const diffDays = Math.round((now - new Date(lastPrincessStudy.date).getTime()) / 86400000);
            if (diffDays >= 5) {
                const normalText = `You haven't studied with Princess in ${diffDays} days. Let's schedule a joint study session!`;
                const observerText = `Peer correlation: no collaborative tasks with Princess in ${diffDays} days (Social continuity pattern).`;

                suggestions.push({
                    type: 'peer_checkin',
                    text: isObserverMode ? observerText : normalText,
                    priority: 'medium',
                    peerId: 'rel_princess',
                    peerName: 'Princess',
                    confidence_score: 0.8,
                    importance_score: 7,
                    score: 5.6,
                    explanation_details: {
                        triggerCondition: `No shared activities with peer Princess in ${diffDays} days.`,
                        lastEventDate: lastPrincessStudy.date,
                        upcomingDeadline: "N/A",
                        recommendation: isObserverMode ? "N/A (Observation Mode active)" : "Propose a shared study slot on the collaborative calendar."
                    }
                });
            }
        } else {
            const normalText = "Princess is online. Let's schedule a study block together!";
            const observerText = "Collaborative peer Princess is active (No shared sessions in database records).";

            suggestions.push({
                type: 'peer_checkin',
                text: isObserverMode ? observerText : normalText,
                priority: 'medium',
                peerId: 'rel_princess',
                peerName: 'Princess',
                confidence_score: 0.8,
                importance_score: 7,
                score: 5.6,
                explanation_details: {
                    triggerCondition: "No shared sessions found in historical records.",
                    lastEventDate: 'Never',
                    upcomingDeadline: "N/A",
                    recommendation: isObserverMode ? "N/A (Observation Mode active)" : "Send an invitation for a Calculus co-working session."
                }
            });
        }

        // Apply Continuity State Machine modifications to suggestions in non-observer mode
        if (!isObserverMode) {
            let state = 'Maintaining';
            try {
                const continuityStability = require('./continuityStability');
                const stateInfo = continuityStability.getContinuityState(userId);
                if (stateInfo) {
                    state = stateInfo.state;
                }
            } catch (e) {
                console.error("jarvisLayer: failed to fetch continuity state:", e.message);
            }

            suggestions.forEach(s => {
                if (state === 'Overloaded') {
                    s.priority = 'high';
                    if (s.type === 'focus_pattern') {
                        s.text = `Overload alert: protect your peak hours (${profile ? profile.best_focus_time : '09:00-11:00'}) for decompression or low-intensity routine preservation.`;
                        s.explanation_details.recommendation = "Take a recovery pause. Defer non-essential study tasks.";
                    } else if (s.type === 'study_gap') {
                        s.text = `Recall gap detected on "${s.subjectName}". However, as your cognitive fronts are overloaded, we recommend postponing study reviews.`;
                        s.explanation_details.recommendation = "Postpone intensive review sessions until load decreases.";
                    } else if (s.type === 'peer_checkin') {
                        s.text = `You haven't studied with ${s.peerName} recently. Since you are overloaded, consider taking a casual break together to decompress.`;
                        s.explanation_details.recommendation = "Propose a casual, low-pressure catch up.";
                    } else {
                        s.text = `Cognitive fronts are overloaded. Pacing recommendations are simplified: reduce task density.`;
                        s.explanation_details.recommendation = "Defer non-essential tasks.";
                    }
                } else if (state === 'Recovering') {
                    if (s.type === 'focus_pattern') {
                        s.text = `You focus best from ${profile ? profile.best_focus_time : '09:00-11:00'}. Since you are recovering, consider a short, gentle focus session.`;
                        s.explanation_details.recommendation = "Schedule a low-load 25-minute study slot.";
                    } else if (s.type === 'study_gap') {
                        s.text = `You haven't touched "${s.subjectName}" in a while. Consider a gentle active recall review when you feel ready.`;
                        s.explanation_details.recommendation = "Schedule a light, low-intensity review.";
                    } else if (s.type === 'peer_checkin') {
                        s.text = `You haven't checked in with ${s.peerName} in a few days. Reach out for supportive, low-intensity study matching when ready.`;
                        s.explanation_details.recommendation = "Initiate a low-intensity study match.";
                    }
                } else if (state === 'Exploring') {
                    if (s.type === 'focus_pattern') {
                        s.text = `Exploring concepts: use your peak ${profile ? profile.best_focus_time : '09:00-11:00'} slot to link notes and explore active projects.`;
                        s.explanation_details.recommendation = "Open your notes network and link related concepts.";
                    }
                } else if (state === 'Building') {
                    if (s.type === 'focus_pattern') {
                        s.text = `High velocity phase: protect your peak ${profile ? profile.best_focus_time : '09:00-11:00'} slot for high priority execution tasks.`;
                        s.explanation_details.recommendation = "Block calendar for high priority project tasks.";
                    }
                }
            });
        }

    } catch (e) {
        console.error("jarvisLayer: Failed to compile suggestions:", e.message);
    }

    // Filter suggestions by cooldown
    const filtered = suggestions.filter(s => {
        const lastShown = cooldownCache[s.type];
        if (lastShown && (now - lastShown < COOLDOWN_DURATION)) {
            return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        return [];
    }

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    // Get only the single top-ranked suggestion
    const top = filtered[0];

    // Mark as shown
    cooldownCache[top.type] = now;

    return [top];
}

module.exports = {
    getProactiveSuggestions,
    cooldownCache
};
