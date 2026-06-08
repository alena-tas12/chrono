const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

console.log("⚙️ Loading Human Continuity & Cognitive Stability Test Environment...");

const mainDb = require('../main/main_db');
const db = mainDb.db;

const continuityStability = require('../main/continuityStability');
const jarvisLayer = require('../main/jarvisLayer');
const interactionAdaptation = require('../main/interactionAdaptation');

async function runTests() {
    console.log("\n🚀 Starting Universal Continuity & Cognitive Stability Integration Tests...");

    const userId = 'test_continuity_user';
    const today = new Date().toISOString().split('T')[0];

    // Clean previous test data
    db.prepare("DELETE FROM tasks").run();
    db.prepare("DELETE FROM goals").run();
    db.prepare("DELETE FROM projects").run();
    db.prepare("DELETE FROM subjects").run();
    db.prepare("DELETE FROM notes").run();
    db.prepare("DELETE FROM memory_chat").run();
    db.prepare("DELETE FROM memory_behavior").run();

    try {
        // ========================================
        // TEST 1: Loop Detection on Repeating Note Keywords
        // ========================================
        console.log("\n1. Testing Cognitive Loop Detector...");
        
        // Insert 5 notes with repeating keyword 'arrays'
        for (let i = 0; i < 5; i++) {
            db.prepare(`
                INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(`note_loop_${i}`, userId, `Topic on arrays part ${i}`, `Details on recursive arrays and allocation.`, Date.now(), Date.now());
        }

        const loops = continuityStability.getLoopDetections(userId);
        console.log("Detected loops:", loops);

        const arraysLoop = loops.find(l => l.topic === 'Arrays');
        if (!arraysLoop) {
            throw new Error("Loop detector failed to identify repeating topic 'Arrays'");
        }
        if (arraysLoop.revisitedCount < 5) {
            throw new Error(`Expected 'Arrays' loop frequency >= 5, got ${arraysLoop.revisitedCount}`);
        }
        console.log("✅ Loop Detector test passed.");

        // ========================================
        // TEST 2: Expansion Risk Classification Math
        // ========================================
        console.log("\n2. Testing Expansion vs Completion Risk...");

        // Insert 12 tasks scheduled recently (1 completed, 11 pending)
        // Ratio = 12 / (1 + 1) = 6.0x -> should trigger High Risk
        const deviceId = mainDb.getDeviceId();
        const now = Date.now();
        
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, updated_at, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('task_comp_1', 'Completed Task', today, 'study', 1, now, deviceId);

        for (let i = 0; i < 11; i++) {
            db.prepare(`
                INSERT INTO tasks (id, text, date, calendar, completed, updated_at, device_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(`task_pend_${i}`, `Pending Task ${i}`, today, 'personal', 0, now, deviceId);
        }

        const metrics = continuityStability.getExpansionMetrics(userId);
        console.log("Expansion Metrics:", metrics);

        if (metrics.expansionRisk !== 'High') {
            throw new Error(`Expected High expansion risk, got: ${metrics.expansionRisk}`);
        }
        console.log("✅ Expansion Risk test passed.");

        // ========================================
        // TEST 3: Observer Mode Suggestions Phrasing Filter
        // ========================================
        console.log("\n3. Testing Observer Mode Jarvis Suggestion Filter...");

        // Set active profile style to 'observer'
        interactionAdaptation.setActiveProfile('observer');

        // Let's seed a goal, project, and subject with last recalled > 5 days ago to trigger study gap suggestion
        db.prepare("INSERT INTO goals (id, user_id, title, status, created_at, updated_at) VALUES ('goal_test_1', ?, 'Test Goal', 'active', ?, ?)")
            .run(userId, now, now);
        db.prepare("INSERT INTO projects (id, goal_id, title, status, created_at, updated_at) VALUES ('proj_test_1', 'goal_test_1', 'Test Project', 'active', ?, ?)")
            .run(now, now);
        db.prepare("INSERT INTO subjects (id, project_id, name, created_at, updated_at) VALUES ('sub_test_1', 'proj_test_1', 'ARM Assembler', ?, ?)")
            .run(now - 10 * 86400000, now - 10 * 86400000);
        db.prepare("INSERT INTO subject_mastery (subject_id, mastery, last_recalled) VALUES ('sub_test_1', 0.5, ?)")
            .run(now - 6 * 86400000); // 6 days ago

        // Clear cooldown cache to guarantee suggestion fires
        jarvisLayer.cooldownCache['study_gap'] = 0;

        const suggestions = jarvisLayer.getProactiveSuggestions(userId);
        console.log("Jarvis Suggestions:", suggestions);

        if (suggestions.length === 0) {
            throw new Error("Jarvis failed to compile study gap suggestion!");
        }

        const topSug = suggestions[0];
        console.log("Top Suggestion Text:", topSug.text);
        console.log("Top Suggestion Rec Action:", topSug.explanation_details.recommendation);

        if (!topSug.text.includes("Recall gap:")) {
            throw new Error(`Expected suggestion text to be neutral and start with 'Recall gap:', got: "${topSug.text}"`);
        }
        if (topSug.explanation_details.recommendation !== "N/A (Observation Mode active)") {
            throw new Error(`Expected recommendation to be suppressed, got: "${topSug.explanation_details.recommendation}"`);
        }
        console.log("✅ Observer Mode Suggestion Filter test passed.");

        // ========================================
        // TEST 4: Communication Assistant Classification Levels
        // ========================================
        console.log("\n4. Testing Communication Assistant Draft Evaluation...");

        // Draft A: Calm & standard length -> Send
        const draftA = "Hey, let's meet tomorrow at 3 PM to review the ARM interrupts laboratory sheet. I can bring my laptop.";
        const evalA = continuityStability.evaluateDraftCommunication(draftA);
        console.log("Draft A Eval:", evalA);
        if (evalA.action !== 'Send' || evalA.emotionalIntensity !== 'Calm') {
            throw new Error(`Expected Action=Send, Intensity=Calm for Draft A, got Action=${evalA.action}, Intensity=${evalA.emotionalIntensity}`);
        }

        // Draft B: Intense keywords -> Save Draft
        const draftB = "This is urgent! We must complete this immediately or we will fail, this is absolutely wrong and bad!";
        const evalB = continuityStability.evaluateDraftCommunication(draftB);
        console.log("Draft B Eval:", evalB);
        if (evalB.action !== 'Save Draft & Re-read' || evalB.emotionalIntensity !== 'High') {
            throw new Error(`Expected Action=Save Draft & Re-read, Intensity=High for Draft B, got Action=${evalB.action}, Intensity=${evalB.emotionalIntensity}`);
        }

        // Draft C: Long draft -> Compress or Note
        const draftC = "Interrupts ".repeat(100); // 1100 chars
        const evalC = continuityStability.evaluateDraftCommunication(draftC);
        console.log("Draft C Eval:", evalC);
        if (evalC.action !== 'Compress or Convert to Note') {
            throw new Error(`Expected Action=Compress or Convert to Note for Draft C, got: ${evalC.action}`);
        }

        // Draft D: Moderate length -> Compress
        const draftD = "Calculus ".repeat(70); // 70 words
        const evalD = continuityStability.evaluateDraftCommunication(draftD);
        console.log("Draft D Eval:", evalD);
        if (evalD.action !== 'Compress') {
            throw new Error(`Expected Action=Compress for Draft D, got: ${evalD.action}`);
        }

        console.log("✅ Communication Assistant test passed.");

        console.log("\n🌟 ALL UNIVERSAL CONTINUITY & COGNITIVE STABILITY TESTS PASSED! 🌟");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ Test suite failed:", e.message || e);
        process.exit(1);
    }
}

runTests();
