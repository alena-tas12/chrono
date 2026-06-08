const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log("⚙️ Loading Memory OS & Relationship OS Test Environment...");

const mainDb = require('../main/main_db');
const db = mainDb.db;

const memoryOS = require('../main/memoryOS');
const notesService = require('../main/notesService');
const relationshipOS = require('../main/relationshipOS');
const jarvisLayer = require('../main/jarvisLayer');

async function runTests() {
    console.log("\n🚀 Starting Chrono OS Phase 5B - 9 Verification Tests...");

    // Helper dates
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const seedTime = Date.now();

    // Clean test records in DB
    db.prepare("DELETE FROM notes WHERE title LIKE '%Test%'").run();
    db.prepare("DELETE FROM tasks WHERE text LIKE '%Test%' OR text LIKE '%Peer Study%'").run();
    db.prepare("DELETE FROM shared_activities WHERE target_id LIKE '%Test%' OR target_id LIKE '%e_shared%'").run();

    try {
        // ========================================
        // TEST 1: Notes CRUD and Auto-linking
        // ========================================
        console.log("\n1. Testing Notes Service & Auto-Linking...");
        
        // Let's check subjects to see what keywords we can use to test auto-linking
        const activeSubjects = db.prepare("SELECT name FROM subjects LIMIT 1").get();
        const subjectKeyword = activeSubjects ? activeSubjects.name : "DSA Problem Solving";
        console.log(`Using subject keyword for auto-linking: "${subjectKeyword}"`);

        const addRes = notesService.addNote('local_user', 'Test Note for verification', `I am studying ${subjectKeyword} today.`, 'private');
        if (!addRes.success || !addRes.noteId) {
            throw new Error("Failed to create note!");
        }
        
        // Fetch note to verify auto-linking
        const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(addRes.noteId);
        if (!note) {
            throw new Error("Note not found in SQLite!");
        }
        
        console.log(`Note created with ID: ${note.id}`);
        console.log(`Auto-linked Goal ID: ${note.linked_goal_id}`);
        console.log(`Auto-linked Project ID: ${note.linked_project_id}`);
        console.log(`Auto-linked Subject ID: ${note.linked_subject_id}`);

        if (!note.linked_subject_id) {
            throw new Error("Note auto-linking failed to match subject name keyword!");
        }
        console.log("✅ Notes Service & Auto-linking test passed.");

        // ========================================
        // TEST 2: Peer Profile and Relationship OS
        // ========================================
        console.log("\n2. Testing Relationship OS & Joint Booking...");

        const peers = relationshipOS.getRelationships('local_user');
        console.log(`Relationships count: ${peers.length}`);
        if (peers.length === 0) {
            throw new Error("Relationships list is empty! Seeding failed.");
        }

        const princessPeer = peers.find(p => p.name === 'Princess');
        if (!princessPeer) {
            throw new Error("Seeded 'Princess' relationship not found!");
        }

        // Schedule a joint session
        const sessionTitle = "Test Joint Study with Princess";
        const sessionDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // tomorrow
        const bookRes = relationshipOS.scheduleJointSession(princessPeer.id, sessionTitle, sessionDate, "14:00", 60);

        if (!bookRes.success || !bookRes.taskId) {
            throw new Error("Failed to schedule joint session with peer!");
        }

        // Check details to verify
        const details = relationshipOS.getRelationshipDetails('local_user', princessPeer.id);
        console.log(`Princess shared events: ${details.sharedEvents.length}`);
        
        const hasSession = details.sharedEvents.some(ev => ev.id === bookRes.taskId && ev.text === sessionTitle);
        if (!hasSession) {
            throw new Error("Scheduled joint session was not linked or fetched correctly in relationship details!");
        }
        console.log("✅ Relationship OS & Joint Booking test passed.");

        // ========================================
        // TEST 3: Memory Cards Compilation
        // ========================================
        console.log("\n3. Testing Memory OS Cards & Aggregation...");

        // Ensure we have completed study tasks to compile cards
        const testTaskId = 'test_card_task_123';
        db.prepare(`
            INSERT OR REPLACE INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, visibility)
            VALUES (?, 'Test Completed Study Session', ?, 'study', 1, '10:00', 120, ?, 'dev', 0, 0, 'private')
        `).run(testTaskId, today, seedTime);

        const cards = memoryOS.getMemoryCards('local_user');
        console.log(`Memory Cards count: ${cards.length}`);
        
        if (cards.length === 0) {
            throw new Error("No memory cards compiled!");
        }

        const currentMonthCard = cards[0];
        console.log(`Month Card: Title="${currentMonthCard.title}", StudyHours=${currentMonthCard.studyHours}, TasksCompleted=${currentMonthCard.tasksCompleted}`);
        
        if (currentMonthCard.studyHours < 2.0) {
            throw new Error("Memory card aggregation did not capture the 120-minute study session correctly!");
        }
        console.log("✅ Memory Cards test passed.");

        // ========================================
        // TEST 4: JARVIS Proactive Suggestion Engine
        // ========================================
        console.log("\n4. Testing JARVIS Proactive Suggestion Engine...");

        const suggestions = jarvisLayer.getProactiveSuggestions('local_user');
        console.log(`JARVIS suggestions found: ${suggestions.length}`);
        suggestions.forEach((s, idx) => {
            console.log(`  [${idx}] Type: ${s.type} | Priority: ${s.priority} | text: "${s.text}"`);
        });

        if (suggestions.length === 0) {
            throw new Error("JARVIS failed to generate suggestions!");
        }

        // Verify focus time suggestion
        const hasFocusPattern = suggestions.some(s => s.type === 'focus_pattern');
        if (!hasFocusPattern) {
            throw new Error("JARVIS did not generate focus pattern suggestion!");
        }
        console.log("✅ JARVIS Suggestion Engine test passed.");

        // ========================================
        // TEST 5: Life Continuity Dashboard Aggregation
        // ========================================
        console.log("\n5. Testing Life Continuity Dashboard Aggregations...");

        const continuity = memoryOS.getLifeContinuity('local_user');
        console.log("Life Continuity questions populated:");
        console.log(" - What mattered?", continuity.whatMattered);
        console.log(" - What changed?", continuity.whatChanged);
        console.log(" - What am I forgetting?", continuity.whatForgetting);
        console.log(" - Who matters?", continuity.whoMatters);
        console.log(" - What progress have I made?", continuity.whatProgress);
        console.log(" - What focus next?", continuity.whatFocusNext);

        if (!continuity.whatFocusNext) {
            throw new Error("Life Continuity Focus Next recommendation was empty!");
        }
        console.log("✅ Life Continuity Dashboard test passed.");

        console.log("\n🌟 ALL MEMORY & RELATIONSHIP OS TESTS PASSED! 🌟");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ Test suite failed:", e.message || e);
        process.exit(1);
    }
}

runTests();
