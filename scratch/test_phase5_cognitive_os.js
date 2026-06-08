const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

console.log("⚙️ Loading Phase 5A Cognitive OS Test Environment...");

const mainDb = require('../main/main_db');
const db = mainDb.db;

const cognitiveProfile = require('../main/cognitiveProfile');
const goalIntelligence = require('../main/goalIntelligence');
const orchestrator = require('../main/cognitiveOrchestrator');

async function runTests() {
    console.log("\n🚀 Starting Chrono OS Phase 5A Integration Tests...");

    const userId = 'test_phase5_user';
    const today = new Date().toISOString().split('T')[0];

    // Clean previous test data
    db.prepare("DELETE FROM tasks").run();
    db.prepare("DELETE FROM goals WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM cognitive_profiles WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM memory_chat WHERE user_input = 'what should I do next'").run();

    try {
        // ========================================
        // TEST 1: Cognitive Profile Engine Calculations
        // ========================================
        console.log("\n1. Testing Cognitive Profile Engine (Peak Windows & Energy Slumps)...");

        const deviceId = mainDb.getDeviceId();
        const now = Date.now();

        // Populate mock task history for last 14 days
        // Insert 3 completed tasks at 10:00 (peak hours)
        for (let i = 0; i < 3; i++) {
            const taskId = `task_peak_${i}`;
            db.prepare(`
                INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
                VALUES (?, 'Phase5 Study Task', ?, 'study', 1, '10:00', 50, ?, ?, 0, 0)
            `).run(taskId, today, now, deviceId);
        }

        // Insert 3 pending tasks at 16:00 (slump hours)
        for (let i = 0; i < 3; i++) {
            const taskId = `task_slump_${i}`;
            db.prepare(`
                INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
                VALUES (?, 'Phase5 Secondary Task', ?, 'personal', 0, '16:00', 60, ?, ?, 0, 0)
            `).run(taskId, today, now, deviceId);
        }

        // Calculate profile
        const profile = cognitiveProfile.calculateCognitiveProfile(userId);
        console.log("Computed best focus window:", profile.best_focus_time);
        console.log("Computed low energy window:", profile.low_energy_time);
        console.log("Computed preferred session length:", profile.preferred_session_length);

        if (profile.best_focus_time !== "09:00-11:00") {
            throw new Error(`Expected best focus time 09:00-11:00, got ${profile.best_focus_time}`);
        }
        if (profile.low_energy_time !== "15:00-17:00") {
            throw new Error(`Expected low energy time 15:00-17:00, got ${profile.low_energy_time}`);
        }
        if (profile.preferred_session_length !== 50) {
            throw new Error(`Expected preferred session length 50, got ${profile.preferred_session_length}`);
        }

        console.log("✅ Cognitive Profile Engine test passed.");

        // ========================================
        // TEST 2: Goal & Study Intelligence CRUD
        // ========================================
        console.log("\n2. Testing Goal Hierarchy CRUD...");

        const goalResult = goalIntelligence.addGoal(userId, "Phase5 Master Embedded Systems", "Target exam goals", today);
        if (!goalResult.success || !goalResult.goalId) {
            throw new Error("Failed to add goal!");
        }

        const projectResult = goalIntelligence.addProject(goalResult.goalId, "Embedded Lab Project", "Lab task checklist");
        if (!projectResult.success || !projectResult.projectId) {
            throw new Error("Failed to add project!");
        }

        const subjectResult = goalIntelligence.addSubject(projectResult.projectId, "Phase5 ARM Interrupts");
        if (!subjectResult.success || !subjectResult.subjectId) {
            throw new Error("Failed to add subject!");
        }

        // Retrieve goal hierarchy
        const goals = goalIntelligence.getGoals(userId);
        console.log(`Fetched ${goals.length} active goals.`);
        
        const testGoal = goals.find(g => g.id === goalResult.goalId);
        if (!testGoal || testGoal.projects.length === 0 || testGoal.projects[0].subjects.length === 0) {
            throw new Error("Retrieved goal hierarchy is missing projects or subjects!");
        }

        const testSubject = testGoal.projects[0].subjects[0];
        console.log("Subject Name:", testSubject.name);
        console.log("Initial Subject Mastery:", testSubject.mastery.mastery);

        if (testSubject.name !== "Phase5 ARM Interrupts" || testSubject.mastery.mastery !== 0.1) {
            throw new Error("Subject mastery row not auto-initialized correctly!");
        }
        console.log("✅ Goal Hierarchy CRUD test passed.");

        // ========================================
        // TEST 3: Spacing Prioritization Ranking
        // ========================================
        console.log("\n3. Testing Goal Prioritization & Spacing Algorithmic Decisions...");

        // Update mastery to 35%
        await goalIntelligence.updateSubjectMastery(subjectResult.subjectId, 0.35, 35);
        
        // Fetch prioritized actions
        const actionProposal = goalIntelligence.getPrioritizedGoalActions(userId, today);
        if (!actionProposal) {
            throw new Error("Goal Intelligence returned empty prioritized actions list!");
        }

        console.log("Prioritized action type:", actionProposal.type);
        console.log("Prioritized action explanation:", actionProposal.explanation);
        console.log("Explainable reasoning bullets:", actionProposal.reasoning_bullets);

        if (actionProposal.type !== 'spaced_study_planning' || actionProposal.confidence !== 0.94) {
            throw new Error("Prioritized action proposal format is incorrect!");
        }

        const studyAction = actionProposal.actions[0];
        console.log("Action Text:", studyAction.text);
        console.log("Action Date:", studyAction.date);
        console.log("Action Start Time (Should match peak 09:00):", studyAction.start_time);
        console.log("Action Duration (Should match peak 50m):", studyAction.duration_min);
        console.log("Associated Goal ID:", studyAction.goal_id);
        console.log("Associated Subject ID:", studyAction.subject_id);

        if (studyAction.text !== "Active Recall: Phase5 ARM Interrupts" || studyAction.start_time !== "09:00" || studyAction.duration_min !== 50) {
            throw new Error("Spaced study action parameters were not correctly optimized based on profile!");
        }

        if (studyAction.goal_id !== goalResult.goalId || studyAction.subject_id !== subjectResult.subjectId) {
            throw new Error("Action tasks are missing foreign key links to Goal/Subject nodes!");
        }
        console.log("✅ Spacing Prioritization test passed.");

        // ========================================
        // TEST 4: Orchestrator Integration & Explainable AI
        // ========================================
        console.log("\n4. Testing Orchestrator Integration (Jarvis Mode + Explainable AI)...");

        // Set user ID to match in DB meta for orchestrator queries
        db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auth_user_id', ?)").run(userId);

        const responseResult = await orchestrator.generateOrchestratedResponse("What should I study next?", { selectedDate: today });
        console.log("Response Agent State Proposal exists:", !!responseResult.state.proposal);
        console.log("Response Text:", responseResult.response);

        if (!responseResult.state.proposal || responseResult.state.proposal.type !== 'spaced_study_planning') {
            throw new Error("Orchestrator failed to intercept query and output Goal Prioritization proposal!");
        }

        const proposal = responseResult.state.proposal;
        console.log("Explainable AI bullet points count:", proposal.reasoning_bullets.length);
        if (!proposal.reasoning_bullets || proposal.reasoning_bullets.length < 3) {
            throw new Error("Orchestrated proposal is missing Explainable AI reasoning bullets!");
        }

        console.log("✅ Orchestrator & Explainable AI test passed.");

        console.log("\n🌟 ALL PHASE 5A ADAPTIVE COGNITIVE OS TESTS PASSED! 🌟");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ Phase 5A Test suite failed:", e.message || e);
        process.exit(1);
    }
}

runTests();
