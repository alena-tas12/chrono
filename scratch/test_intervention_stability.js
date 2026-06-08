const path = require('path');
const fs = require('fs');

// Import database handle and modules
const mainDb = require('../main/main_db');
const db = mainDb.db;
const continuityStability = require('../main/continuityStability');
const jarvisLayer = require('../main/jarvisLayer');
const interactionAdaptation = require('../main/interactionAdaptation');

async function runTests() {
    console.log("🚀 Starting Phase 13-14 Universal Continuity Stability Tests...");
    
    // Setup test parameters/data
    const userId = 'local_user';
    const originalProfile = db.prepare("SELECT value FROM memory_behavior WHERE type = 'active_profile'").get()?.value || 'adaptive';

    try {
        // --- 1. Loop Intervention Classifier & Actions ---
        console.log("\n1. Testing Loop Intervention Classifier & Actions...");
        
        // Clean up loop topic just in case
        db.prepare("DELETE FROM cognitive_loops WHERE topic = ?").run('TestLoopTopic');
        
        // Add loop detections text to note & chat
        const testNoteId = 'note_test_loop';
        db.prepare(`
            INSERT OR REPLACE INTO notes (id, user_id, title, content, importance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(testNoteId, userId, 'TestLoopTopic note title', 'Repetitive testlooptopic content here.', 5, Date.now(), Date.now());

        // Forcing loop row for intervention testing.
        db.prepare("INSERT OR REPLACE INTO cognitive_loops (topic, revisited_count, status, resolution_action, updated_at) VALUES ('TestLoopTopic', 6, 'no_new_development', 'continue_reflection', ?)").run(Date.now());

        // Try resolving loop
        console.log("Resolving loop topic with status 'active' and action 'schedule_review'...");
        const resolveRes = continuityStability.resolveLoopIntervention('TestLoopTopic', 'active', 'schedule_review');
        if (!resolveRes.success) {
            throw new Error("Loop resolution failed: " + resolveRes.error);
        }

        // Verify scheduled task
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const scheduled = db.prepare("SELECT * FROM tasks WHERE text LIKE '%Review Repeating Topic: TestLoopTopic%' AND date = ? AND deleted = 0").get(tomorrowStr);
        if (!scheduled) {
            throw new Error("Intervention did not schedule tomorrow's review task!");
        }
        console.log("✅ Loop Intervention successfully resolved and scheduled review: " + scheduled.text);

        // --- 2. Continuity State Machine ---
        console.log("\n2. Testing Continuity State Machine...");
        
        // Set up parameters to force different states
        // Overloaded State: highLoadFronts >= 2 or pendingCount >= 15
        console.log("Injecting pending tasks to trigger Overloaded State...");
        
        // Insert 16 temporary pending tasks
        const tempTaskIds = [];
        for (let i = 0; i < 16; i++) {
            const tid = `task_temp_${i}`;
            db.prepare(`
                INSERT INTO tasks (id, text, date, calendar, completed, duration_min, updated_at, synced, deleted)
                VALUES (?, 'Temp overload task', '2026-06-01', 'personal', 0, 30, ?, 0, 0)
            `).run(tid, Date.now());
            tempTaskIds.push(tid);
        }
        
        let stateObj = continuityStability.getContinuityState(userId);
        console.log(`Current state: ${stateObj.state} (${stateObj.explanation})`);
        if (stateObj.state !== 'Overloaded') {
            throw new Error("State machine failed to detect Overloaded state!");
        }
        console.log("✅ Overloaded State successfully detected.");

        // Clean up overloaded tasks
        for (const tid of tempTaskIds) {
            db.prepare("DELETE FROM tasks WHERE id = ?").run(tid);
        }

        // Recalculate state to normalize
        stateObj = continuityStability.getContinuityState(userId);
        console.log(`State recalculated: ${stateObj.state}`);

        // --- 3. Observer Mode Suggestion Sectioning ---
        console.log("\n3. Testing Observer Mode and suggestions filtering...");
        
        // Set profile to observer
        db.prepare("DELETE FROM memory_behavior WHERE type = 'active_profile'").run();
        db.prepare("INSERT INTO memory_behavior (type, value, timestamp) VALUES ('active_profile', 'observer', ?)").run(Date.now());
        
        const suggestions = jarvisLayer.getProactiveSuggestions(userId);
        if (suggestions.length === 0 || suggestions[0].type !== 'observer_dashboard') {
            throw new Error("Observer Mode did not return the observer dashboard suggestion!");
        }
        
        const topSuggestion = suggestions[0];
        console.log("Observer Suggestion details:");
        console.log(`- Text: ${topSuggestion.text}`);
        if (!topSuggestion.observerLayers || !topSuggestion.observerLayers.pattern || !topSuggestion.observerLayers.trend || !topSuggestion.observerLayers.history) {
            throw new Error("Observer Suggestion is missing the three structured layers (pattern, trend, history)!");
        }
        console.log("✅ Observer Mode structured sections verified.");

        // --- 4. Personal OS Operating Style ---
        console.log("\n4. Testing Personal OS Operating Style...");
        const osProfile = continuityStability.getPersonalOS(userId);
        console.log("Inferred Personal OS parameters:");
        console.log(`- Focus Style: ${osProfile.focusStyle}`);
        console.log(`- Planning Style: ${osProfile.planningStyle}`);
        console.log(`- Review Style: ${osProfile.reviewStyle}`);
        console.log(`- Peak Hours: ${osProfile.peakHours}`);
        if (!osProfile.focusStyle || !osProfile.planningStyle || !osProfile.peakHours) {
            throw new Error("Personal OS returned missing properties.");
        }
        console.log("✅ Personal OS profile verified.");

        // --- 5. Human Continuity Index formula scoring ---
        console.log("\n5. Testing Human Continuity Index scoring...");
        const indexResult = continuityStability.getContinuityIndex(userId);
        console.log(`Overall Continuity Index: ${indexResult.overallIndex}/100`);
        console.log("Sub-scores:", indexResult.subScores);
        if (typeof indexResult.overallIndex !== 'number' || indexResult.overallIndex < 0 || indexResult.overallIndex > 100) {
            throw new Error("Continuity index score calculation failed bounds checks!");
        }
        console.log("✅ Continuity Index score verified.");

        // --- 6. Trust & Reliability Telemetry ---
        console.log("\n6. Testing Trust & Reliability telemetry...");
        const trust = continuityStability.getTrustReliability(userId);
        console.log("Trust metrics:", trust);
        if (!trust.dataIntegrity || !trust.syncHealth || !trust.backupStatus || typeof trust.memoryCoverage !== 'number') {
            throw new Error("Trust dashboard telemetry returned incomplete properties.");
        }
        console.log("✅ Trust & Reliability metrics verified.");

        console.log("\n🌟 ALL CONTINUITY STABILITY TESTS PASSED! 🌟");

    } catch (e) {
        console.error("❌ Test suite failed:", e.message);
        process.exit(1);
    } finally {
        // Clean up
        db.prepare("DELETE FROM cognitive_loops WHERE topic = ?").run('TestLoopTopic');
        db.prepare("DELETE FROM notes WHERE id = ?").run('note_test_loop');
        db.prepare("DELETE FROM tasks WHERE text LIKE '%Review Repeating Topic: TestLoopTopic%'").run();
        
        // Restore active profile
        db.prepare("DELETE FROM memory_behavior WHERE type = 'active_profile'").run();
        db.prepare("INSERT INTO memory_behavior (type, value, timestamp) VALUES ('active_profile', ?, ?)").run(originalProfile, Date.now());
        
        process.exit(0);
    }
}

runTests();
