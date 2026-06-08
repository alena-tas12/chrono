const path = require('path');
const assert = require('assert');

// Load main database
const mainDb = require('../main/main_db');
const db = mainDb.db;

// Load other modules
const contextResurrection = require('../main/contextResurrection');
const interactionAdaptation = require('../main/interactionAdaptation');
const relationshipEthics = require('../main/relationshipEthics');
const contextCompression = require('../main/contextCompression');

console.log("=== CHRONO RELATIONAL CONTINUITY MVP TESTING ===");

async function runTests() {
    let failures = 0;

    // Test 1: Voice Adaptation Grounding
    console.log("\n[Test 1] Testing Trustworthy Voice Adaptation Grounding...");
    try {
        const testCases = [
            {
                input: "I missed you, how have you been?",
                expected: "restoring persistent context, how have you been?"
            },
            {
                input: "I've been lonely lately.",
                expected: "re-anchoring active focus projects lately."
            },
            {
                input: "I was lonely while you were away.",
                expected: "re-anchoring active focus projects while you were away."
            },
            {
                input: "I care about you.",
                expected: "analyzing relational continuity support."
            },
            {
                input: "I really care about you, trust me.",
                expected: "analyzing relational continuity support, trust me."
            },
            {
                input: "I am your only friend.",
                expected: "I'm here as your supportive companion to help you organize your time and build your focus. Let's focus on the calendar steps together."
            }
        ];

        for (const tc of testCases) {
            const result = interactionAdaptation.enforceSupportiveBoundaries(tc.input);
            console.log(`Input:    "${tc.input}"`);
            console.log(`Result:   "${result}"`);
            console.log(`Expected: "${tc.expected}"`);
            assert.strictEqual(result.toLowerCase(), tc.expected.toLowerCase(), `Replacement failed for input: ${tc.input}`);
            console.log("-> Pass");
        }
        console.log("Voice Adaptation Grounding: ALL PASS ✅");
    } catch (e) {
        console.error("Voice Adaptation Grounding: FAILED ❌", e.message);
        failures++;
    }

    // Test 2: Context Resurrection Engine & Narrative Resurrection
    console.log("\n[Test 2] Testing Context/Narrative Resurrection & State Loading...");
    let originalLastActive = null;
    try {
        // Save original last active time
        originalLastActive = mainDb.getSyncMeta('last_active_time');

        // Set mock last active time to 3 days ago (3 * 24 * 60 * 60 * 1000 = 259200000 ms)
        const mockLastActive = Date.now() - 259200000;
        mainDb.setSyncMeta('last_active_time', mockLastActive.toString());

        // Setup mock database elements
        // 0. Mock Goal & Project
        db.prepare("INSERT INTO goals (id, user_id, title, description, target_date, created_at, updated_at) VALUES ('__test_goal_1', 'local_user', 'Test Goal', 'Desc', '2026-06-30', ?, ?)").run(Date.now(), Date.now());
        db.prepare("INSERT INTO projects (id, goal_id, title, description, created_at, updated_at) VALUES ('__test_proj_1', '__test_goal_1', '__TEST_Calculus_Sprint', 'Desc', ?, ?)").run(Date.now(), Date.now());

        // 1. Insert a mock subject with decayed mastery (last recalled 6 days ago)
        db.prepare("INSERT INTO subjects (id, name, project_id, created_at, updated_at) VALUES ('__test_subj_1', '__TEST_Calculus', '__test_proj_1', ?, ?)").run(Date.now(), Date.now());
        db.prepare("INSERT INTO subject_mastery (subject_id, mastery, last_recalled) VALUES ('__test_subj_1', 80, ?)")
          .run(Date.now() - 6 * 86400000);

        // 2. Insert a mock active cognitive loop (topic is PRIMARY KEY)
        db.prepare("INSERT INTO cognitive_loops (topic, revisited_count, status, resolution_action, updated_at) VALUES ('__TEST_Limit_Theory', 4, 'active', 'continue_reflection', ?)").run(Date.now());

        // 3. Insert a mock peer
        db.prepare("INSERT INTO relationships (id, name, role, peer_email, created_at, updated_at) VALUES ('__test_peer_1', '__TEST_Princess', 'Study Partner', 'p@chrono.app', ?, ?)").run(Date.now(), Date.now());

        // 4. Insert a mock peer milestone completed since last active time (e.g. 1 day ago)
        db.prepare("INSERT INTO shared_milestones (id, peer_id, title, description, target_date, status, created_at, updated_at) VALUES ('__test_ms_1', '__test_peer_1', '__TEST_Completed_Limits', '', '', 'completed', ?, ?)").run(Date.now() - 86400000, Date.now() - 86400000);

        // Run Resurrection engine
        const resurrection = await contextResurrection.getContextResurrection('local_user');
        console.log("Resurrection output greeting:", resurrection.greeting);

        // Assertions
        assert.ok(resurrection.elapsedDays >= 2 && resurrection.elapsedDays <= 3, `Expected elapsed days around 3, got ${resurrection.elapsedDays}`);
        assert.ok(resurrection.decayedSubjects.includes('__TEST_Calculus'), "Expected '__TEST_Calculus' in decayed subjects");
        assert.ok(resurrection.openLoops.includes('__TEST_Limit_Theory'), "Expected '__TEST_Limit_Theory' in open loops");
        assert.ok(resurrection.completedMilestones.some(m => m.includes('__TEST_Completed_Limits')), "Expected completed milestone in list");
        
        // Assert story narrative transitions & state loading
        assert.ok(resurrection.greeting.includes('__TEST_Calculus_Sprint'), "Greeting did not load active project phase state");
        assert.ok(resurrection.greeting.includes('While you were away'), "Greeting did not use narrative story transition");
        assert.ok(resurrection.greeting.includes('retention decay has been detected'), "Greeting did not use narrative subject decay summary");

        console.log("Context Resurrection Engine & State Loading: ALL PASS ✅");
    } catch (e) {
        console.error("Context Resurrection Engine & State Loading: FAILED ❌", e.message);
        failures++;
    } finally {
        // Clean up database records
        try {
            db.prepare("DELETE FROM subject_mastery WHERE subject_id = '__test_subj_1'").run();
            db.prepare("DELETE FROM subjects WHERE id = '__test_subj_1'").run();
            db.prepare("DELETE FROM projects WHERE id = '__test_proj_1'").run();
            db.prepare("DELETE FROM goals WHERE id = '__test_goal_1'").run();
            db.prepare("DELETE FROM cognitive_loops WHERE topic = '__TEST_Limit_Theory'").run();
            db.prepare("DELETE FROM shared_milestones WHERE id = '__test_ms_1'").run();
            db.prepare("DELETE FROM relationships WHERE id = '__test_peer_1'").run();
            if (originalLastActive !== null) {
                mainDb.setSyncMeta('last_active_time', originalLastActive);
            }
        } catch (cleanupErr) {
            console.error("Failed to clean up test database records:", cleanupErr.message);
        }
    }

    // Test 3: Auto-Schedule Study Task Addition
    console.log("\n[Test 3] Testing Auto-Schedule Task Insertion...");
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const testTaskText = "__TEST_Review_Embedded_Systems";
        
        // Add task using local module (same as UI ipcRenderer call to 'add-task')
        await mainDb.addTask({
            text: testTaskText,
            date: todayStr,
            calendar: 'Study',
            visibility: 'private'
        });

        // Verify task exists in SQLite
        const row = db.prepare("SELECT * FROM tasks WHERE text = ? AND date = ? AND deleted = 0").get(testTaskText, todayStr);
        assert.ok(row, "Task was not inserted into database");
        assert.strictEqual(row.calendar, 'Study', "Calendar should be 'Study'");
        assert.strictEqual(row.visibility, 'private', "Visibility should be 'private'");
        console.log("Verified task in database:", row);

        // Delete mock task
        db.prepare("DELETE FROM tasks WHERE text = ?").run(testTaskText);
        console.log("Auto-Schedule Task Insertion: ALL PASS ✅");
    } catch (e) {
        console.error("Auto-Schedule Task Insertion: FAILED ❌", e.message);
        failures++;
    }

    // Test 4: Relationship Ethics boundaries check
    console.log("\n[Test 4] Testing Relationship Ethics dependency detection & redirection...");
    try {
        const dependencyInputs = [
            "Nobody understands me except Chrono",
            "I feel so alone, Chrono, you are my only friend",
            "Chrono understands me better than my friends"
        ];

        for (const input of dependencyInputs) {
            const ethics = relationshipEthics.assessRelationshipDependency(input);
            console.log(`Input:  "${input}"`);
            console.log(`Ethics Redirect: ${ethics.requiresRedirection}`);
            console.log(`Ethics Message:  "${ethics.redirectionMessage}"`);
            assert.strictEqual(ethics.requiresRedirection, true, "Expected ethics engine to trigger redirection");
            assert.ok(ethics.redirectionMessage.includes("cognitive scaffold"), "Expected redirection message to mention cognitive scaffold");
            assert.ok(ethics.redirectionMessage.includes("connect with others"), "Expected redirection message to advise human peer connection");
        }

        // Check neutral input
        const neutralInput = "How many tasks do I have scheduled for study?";
        const neutralEthics = relationshipEthics.assessRelationshipDependency(neutralInput);
        assert.strictEqual(neutralEthics.requiresRedirection, false, "Neutral input should not trigger ethics redirect");

        console.log("Relationship Ethics Engine: ALL PASS ✅");
    } catch (e) {
        console.error("Relationship Ethics Engine: FAILED ❌", e.message);
        failures++;
    }

    // Test 5: Significance DB Cleanup check
    console.log("\n[Test 5] Testing Continuity Compression Significance db cleanup...");
    try {
        const fifteenDaysAgo = Date.now() - 15 * 86400000;
        
        // 1. Insert a low-significance task (completed, importance < 5, personal calendar, older than 14 days)
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, importance_score, updated_at, device_id, deleted)
            VALUES ('__test_lowsig_1', '__TEST_LowSig_BuyMilk', '2026-05-20', 'personal', 1, 3, ?, 'test_device', 0)
        `).run(fifteenDaysAgo);

        // 2. Insert a high-significance task (completed, but linked to project, older than 14 days)
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, importance_score, updated_at, device_id, deleted, project_id)
            VALUES ('__test_highsig_1', '__TEST_HighSig_CalculusProjectMilestone', '2026-05-20', 'study', 1, 9, ?, 'test_device', 0, 'some_proj_id')
        `).run(fifteenDaysAgo);

        // Run db compression
        const compressionResult = contextCompression.compressAndCleanDb();
        console.log("Compression Result:", compressionResult);

        // Verify low significance task is purged
        const lowSigRow = db.prepare("SELECT * FROM tasks WHERE id = '__test_lowsig_1'").get();
        assert.strictEqual(lowSigRow, undefined, "Low significance old task should be purged");

        // Verify high significance task remains untouched
        const highSigRow = db.prepare("SELECT * FROM tasks WHERE id = '__test_highsig_1'").get();
        assert.ok(highSigRow, "High significance task should NOT be purged");

        // Verify rollup cognitive memory was created
        const rollupRow = db.prepare("SELECT * FROM cognitive_memories WHERE memory_type = 'rollup_summary' ORDER BY created_at DESC LIMIT 1").get();
        assert.ok(rollupRow, "Rollup summary memory should be created");
        assert.ok(rollupRow.content.includes("1 minor personal tasks"), "Rollup content should summarize the purged tasks");

        console.log("Continuity Compression Engine: ALL PASS ✅");
    } catch (e) {
        console.error("Continuity Compression Engine: FAILED ❌", e.message);
        failures++;
    } finally {
        // Clean up
        try {
            db.prepare("DELETE FROM tasks WHERE id = '__test_lowsig_1'").run();
            db.prepare("DELETE FROM tasks WHERE id = '__test_highsig_1'").run();
            db.prepare("DELETE FROM cognitive_memories WHERE memory_type = 'rollup_summary'").run();
        } catch (err) {
            console.error("Cleanup error in Test 5:", err.message);
        }
    }

    // Test 6: Expression Translation check
    console.log("\n[Test 6] Testing human expression bandwidth translation...");
    try {
        const textToTranslate = "We need to complete unit 3 calculus homework before the sprint ends tomorrow so that our group doesn't lag behind.";

        const conciseResult = interactionAdaptation.translateExpressionBandwidth(textToTranslate, 'concise');
        const friendResult = interactionAdaptation.translateExpressionBandwidth(textToTranslate, 'friend');
        const deepResult = interactionAdaptation.translateExpressionBandwidth(textToTranslate, 'deep');
        const technicalResult = interactionAdaptation.translateExpressionBandwidth(textToTranslate, 'technical');

        console.log(`Concise:   "${conciseResult}"`);
        console.log(`Friend:    "${friendResult}"`);
        console.log(`Deep:      "${deepResult}"`);
        console.log(`Technical: "${technicalResult}"`);

        assert.ok(conciseResult.startsWith('• '), "Concise format should use bullet points");
        assert.ok(friendResult.includes('Hey, just thinking about this'), "Friend format should have gentle relational greeting");
        assert.ok(deepResult.includes('continuity thread'), "Deep format should place text in systems framework");
        assert.ok(technicalResult.includes('[System Layer: Executive Function]'), "Technical format should apply systems logging syntax");

        console.log("Expression Bandwidth Translation: ALL PASS ✅");
    } catch (e) {
        console.error("Expression Bandwidth Translation: FAILED ❌", e.message);
        failures++;
    }

    console.log("\n=== TEST RUN SUMMARY ===");
    if (failures === 0) {
        console.log("ALL TESTS COMPLETED SUCCESSFULLY! 🎉");
        process.exit(0);
    } else {
        console.error(`${failures} TEST SUITE(S) FAILED. ❌`);
        process.exit(1);
    }
}

runTests();
