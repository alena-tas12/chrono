const mainDb = require('./main_db');
const db = mainDb.db;
const cognitiveProfile = require('./cognitiveProfile');

/**
 * 📋 GOAL & STUDY INTELLIGENCE ENGINE
 * Manages the Goal-Project-Subject hierarchy and computes learning recommendations
 * based on target goals, exam dates, subject mastery, and cognitive rhythms.
 */

// ========================================
// 🎯 CRUD HELPERS
// ========================================

function addGoal(userId, title, description, targetDate) {
    const id = 'g_' + Math.random().toString(36).substring(2, 11);
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO goals (id, user_id, title, description, target_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
        `).run(id, userId, title, description || null, targetDate || null, now, now);
        return { success: true, goalId: id };
    } catch (e) {
        console.error("goalIntelligence: Failed to add goal:", e.message);
        return { success: false, error: e.message };
    }
}

function getGoals(userId) {
    try {
        const goals = db.prepare("SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY target_date ASC").all(userId);
        
        for (const goal of goals) {
            const projects = db.prepare("SELECT * FROM projects WHERE goal_id = ? AND status = 'active'").all(goal.id);
            for (const project of projects) {
                const subjects = db.prepare("SELECT * FROM subjects WHERE project_id = ?").all(project.id);
                for (const subject of subjects) {
                    let mastery = db.prepare("SELECT * FROM subject_mastery WHERE subject_id = ?").get(subject.id);
                    if (!mastery) {
                        db.prepare(`
                            INSERT OR IGNORE INTO subject_mastery (subject_id, mastery, quiz_scores, revision_frequency, last_recalled)
                            VALUES (?, 0.0, '[]', 0, 0)
                        `).run(subject.id);
                        mastery = { mastery: 0.0, quiz_scores: '[]', revision_frequency: 0, last_recalled: 0 };
                    } else {
                        mastery.quiz_scores = JSON.parse(mastery.quiz_scores);
                    }
                    subject.mastery = mastery;
                }
                project.subjects = subjects;
            }
            goal.projects = projects;
        }
        return goals;
    } catch (e) {
        console.error("goalIntelligence: Failed to fetch goals:", e.message);
        return [];
    }
}

function deleteGoal(goalId) {
    try {
        db.prepare("UPDATE goals SET status = 'deleted', updated_at = ? WHERE id = ?").run(Date.now(), goalId);
        return { success: true };
    } catch (e) {
        console.error("goalIntelligence: Failed to delete goal:", e.message);
        return { success: false, error: e.message };
    }
}

function addProject(goalId, title, description) {
    const id = 'p_' + Math.random().toString(36).substring(2, 11);
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO projects (id, goal_id, title, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?)
        `).run(id, goalId, title, description || null, now, now);
        return { success: true, projectId: id };
    } catch (e) {
        console.error("goalIntelligence: Failed to add project:", e.message);
        return { success: false, error: e.message };
    }
}

function addSubject(projectId, name) {
    const id = 's_' + Math.random().toString(36).substring(2, 11);
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO subjects (id, project_id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, projectId, name, now, now);
        
        // Auto-initialize subject mastery row
        db.prepare(`
            INSERT OR IGNORE INTO subject_mastery (subject_id, mastery, quiz_scores, revision_frequency, last_recalled)
            VALUES (?, 0.1, '[]', 0, 0)
        `).run(id);

        return { success: true, subjectId: id };
    } catch (e) {
        console.error("goalIntelligence: Failed to add subject:", e.message);
        return { success: false, error: e.message };
    }
}

function getSubjectMastery(subjectId) {
    try {
        const row = db.prepare("SELECT * FROM subject_mastery WHERE subject_id = ?").get(subjectId);
        if (row) {
            return {
                ...row,
                quiz_scores: JSON.parse(row.quiz_scores)
            };
        }
    } catch (e) {
        console.error("goalIntelligence: Failed to get subject mastery:", e.message);
    }
    return null;
}

function updateSubjectMastery(subjectId, mastery, quizScore = null) {
    try {
        const row = db.prepare("SELECT * FROM subject_mastery WHERE subject_id = ?").get(subjectId);
        let scores = [];
        let freq = 0;
        if (row) {
            scores = JSON.parse(row.quiz_scores);
            freq = row.revision_frequency;
        }

        if (quizScore !== null) {
            scores.push({
                score: quizScore,
                timestamp: Date.now()
            });
        }

        db.prepare(`
            INSERT OR REPLACE INTO subject_mastery (subject_id, mastery, quiz_scores, revision_frequency, last_recalled)
            VALUES (?, ?, ?, ?, ?)
        `).run(subjectId, mastery, JSON.stringify(scores), freq + 1, Date.now());

        return { success: true };
    } catch (e) {
        console.error("goalIntelligence: Failed to update subject mastery:", e.message);
        return { success: false, error: e.message };
    }
}

// ========================================
// 🧠 PRIORITIZATION ALGORITHM (Jarvis Logic)
// ========================================

function getPrioritizedGoalActions(userId, today) {
    const todayStr = today || new Date().toISOString().split('T')[0];
    const goals = getGoals(userId);

    if (goals.length === 0) {
        return null;
    }

    const flatSubjects = [];

    goals.forEach(goal => {
        let daysRemaining = 14; // Default baseline urgency
        if (goal.target_date) {
            const diffMs = new Date(goal.target_date + "T00:00:00").getTime() - Date.now();
            daysRemaining = Math.max(1, Math.round(diffMs / 86400000));
        }

        (goal.projects || []).forEach(project => {
            (project.subjects || []).forEach(subject => {
                const masteryVal = subject.mastery ? subject.mastery.mastery : 0.0;
                
                // Calculate priority score: Lower mastery and closer goal target date = higher priority
                // Urgency factor starts high for close dates
                const urgencyFactor = 100 / daysRemaining;
                const masteryGap = 1.0 - masteryVal;
                const priorityScore = urgencyFactor * masteryGap;

                flatSubjects.push({
                    goal,
                    project,
                    subject,
                    daysRemaining,
                    mastery: masteryVal,
                    lastRecalled: subject.mastery ? subject.mastery.last_recalled : 0,
                    priorityScore
                });
            });
        });
    });

    if (flatSubjects.length === 0) {
        return null;
    }

    // Sort by priority score descending
    flatSubjects.sort((a, b) => b.priorityScore - a.priorityScore);

    // Pick top prioritized subject to build revision block
    const top = flatSubjects[0];
    const profile = cognitiveProfile.getCognitiveProfile(userId);

    // Parse focus hour start (e.g. "09:00-11:00" -> "09:00")
    let startTime = "09:00";
    if (profile.best_focus_time) {
        const matches = profile.best_focus_time.match(/^(\d{2}:\d{2})/);
        if (matches) startTime = matches[1];
    }

    const duration = profile.preferred_session_length || 45;

    const actionText = `Active Recall: ${top.subject.name}`;
    const taskId = 'e_' + Math.random().toString(36).substring(2, 11);

    // Generate explainable bullets
    const reasoningBullets = [
        `Subject mastery is currently low (${Math.round(top.mastery * 100)}%)`,
        `Linked goal "${top.goal.title}" target date is in ${top.daysRemaining} days`,
        `Calculated best focus window is ${profile.best_focus_time} (scheduling at ${startTime})`
    ];

    if (top.lastRecalled === 0) {
        reasoningBullets.push("No active recall session recorded yet for this subject");
    } else {
        const daysSinceRecall = Math.round((Date.now() - top.lastRecalled) / 86400000);
        reasoningBullets.push(`${daysSinceRecall} days elapsed since your last practice session`);
    }

    return {
        type: 'spaced_study_planning',
        confidence: 0.94,
        reason: 'Priority goal execution recommended by cognitive study intelligence.',
        explanation: `Based on your upcoming goal to **"${top.goal.title}"** (in ${top.daysRemaining} days), I propose scheduling a revision block for **"${top.subject.name}"** today. Your current mastery is ${Math.round(top.mastery * 100)}%, and placing this session during your peak focus hours will optimize retention.`,
        reasoning_bullets: reasoningBullets,
        actions: [{
            type: 'add',
            id: taskId,
            text: actionText,
            date: todayStr,
            calendar: 'study',
            start_time: startTime,
            duration_min: duration,
            goal_id: top.goal.id,
            project_id: top.project.id,
            subject_id: top.subject.id
        }]
    };
}

module.exports = {
    addGoal,
    getGoals,
    deleteGoal,
    addProject,
    addSubject,
    getSubjectMastery,
    updateSubjectMastery,
    getPrioritizedGoalActions
};
