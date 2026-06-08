const mainDb = require('../main/main_db');
const db = mainDb.db;

const memoryOS = require('../main/memoryOS');
const notesService = require('../main/notesService');
const relationshipOS = require('../main/relationshipOS');
const jarvisLayer = require('../main/jarvisLayer');

async function runTests() {
    console.log("🚀 Starting Chrono OS Revised V1 Continuity Verification Suite...");

    const today = new Date().toISOString().split('T')[0];
    const seedTime = Date.now();

    // Clean databases first
    db.prepare("DELETE FROM notes WHERE title LIKE '%Test%'").run();
    db.prepare("DELETE FROM tasks WHERE text LIKE '%Test%'").run();
    db.prepare("DELETE FROM shared_activities WHERE target_id LIKE '%Test%'").run();

    try {
        // ========================================
        // 1. Math Significance Ranking Test
        // ========================================
        console.log("\n🧪 Test 1: Math Significance Scoring & Ranking...");
        
        // Create 2 test notes with different importance/impact/dates
        const noteId1 = 'test_note_low';
        const noteId2 = 'test_note_high';
        
        // Note 1: Importance 2, Impact 2, created today
        db.prepare(`
            INSERT INTO notes (id, user_id, title, content, created_at, updated_at, visibility, importance_score, impact_score)
            VALUES (?, 'local_user', 'Test Note Low', 'Content low significance', ?, ?, 'private', 2, 2)
        `).run(noteId1, seedTime, seedTime);

        // Note 2: Importance 9, Impact 9, created today
        db.prepare(`
            INSERT INTO notes (id, user_id, title, content, created_at, updated_at, visibility, importance_score, impact_score)
            VALUES (?, 'local_user', 'Test Note High', 'Content high significance', ?, ?, 'private', 9, 9)
        `).run(noteId2, seedTime, seedTime);

        const searchResults = memoryOS.searchMemories('local_user', 'Test Note');
        console.log(`Search results count: ${searchResults.length}`);
        
        if (searchResults.length < 2) {
            throw new Error("Search did not return all seeded test notes!");
        }

        console.log(`First sorted result: "${searchResults[0].title}" (Significance: ${searchResults[0].significance})`);
        console.log(`Second sorted result: "${searchResults[1].title}" (Significance: ${searchResults[1].significance})`);

        if (searchResults[0].id !== noteId2) {
            throw new Error("Significance ranking failed! Note with high score should be sorted first.");
        }
        console.log("✅ Math Significance Ranking test passed.");


        // ========================================
        // 2. Memory Consolidation Test
        // ========================================
        console.log("\n🧪 Test 2: Memory Consolidation Summaries...");

        // Seed 5 completed tasks under a study subject in this month
        const subject = db.prepare("SELECT id, name FROM subjects LIMIT 1").get();
        if (!subject) {
            throw new Error("No subjects in database! Run seeding scripts first.");
        }
        
        const yearMonth = today.substring(0, 7); // e.g. "2026-05"
        console.log(`Seeding 5 tasks under subject "${subject.name}" for month ${yearMonth}...`);

        for (let i = 0; i < 5; i++) {
            db.prepare(`
                INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, subject_id)
                VALUES (?, ?, ?, 'study', 1, '14:00', 60, ?, 'dev', 0, 0, ?)
            `).run(`test_task_consol_${i}`, `Test Completed Session ${i}`, today, seedTime, subject.id);
        }

        const consolidatedText = memoryOS.consolidateActivity('local_user', yearMonth);
        console.log(`Consolidation summary: "${consolidatedText}"`);

        if (!consolidatedText.includes(subject.name) || !consolidatedText.includes("became a major focus")) {
            throw new Error("Memory consolidation failed to summarize the 5 completed study sessions!");
        }
        console.log("✅ Memory Consolidation test passed.");


        // ========================================
        // 3. Month-over-Month Identity Timeline Test
        // ========================================
        console.log("\n🧪 Test 3: Month-over-Month Identity Timeline Narratives...");

        // Ensure we have stress keywords in a note to trigger Recovery mode style
        db.prepare(`
            INSERT INTO notes (id, user_id, title, content, created_at, updated_at, visibility)
            VALUES ('test_note_stress', 'local_user', 'Test stressed note', 'I am feeling overwhelmed and tired today.', ?, ?, 'private')
        `).run(seedTime, seedTime);

        const narrative = memoryOS.getIdentityTimeline('local_user', yearMonth);
        console.log(`Identity narrative: "${narrative}"`);

        if (!narrative.includes("Recovery & Resilience Focus") && !narrative.includes("Academic Growth")) {
            throw new Error("Identity timeline generation returned an unexpected theme!");
        }
        console.log("✅ Identity Timeline test passed.");


        // ========================================
        // 4. Selective Sharing Boundaries Test
        // ========================================
        console.log("\n🧪 Test 4: Selective Sharing Boundaries...");

        const peers = relationshipOS.getRelationships('local_user');
        if (peers.length < 2) {
            throw new Error("Not enough seeded relationships to run sharing boundaries test! Run default seeds.");
        }

        const peerA = peers[0]; // e.g. Princess
        const peerB = peers[1]; // e.g. Rayhaan
        console.log(`Peer A: "${peerA.name}" (ID: ${peerA.id})`);
        console.log(`Peer B: "${peerB.name}" (ID: ${peerB.id})`);

        // Create a note shared SPECIFICALLY with Peer A (Princess) only
        const sharedNoteId = 'test_note_shared_spec';
        notesService.addNote('local_user', 'Test Selective Note', 'Calculus review questions.', 'shared_specific', [peerA.id], 5, 5);

        // Fetch details for Peer A
        const detailsA = relationshipOS.getRelationshipDetails('local_user', peerA.id);
        const hasNoteA = detailsA.sharedNotes.some(n => n.title === 'Test Selective Note');

        // Fetch details for Peer B
        const detailsB = relationshipOS.getRelationshipDetails('local_user', peerB.id);
        const hasNoteB = detailsB.sharedNotes.some(n => n.title === 'Test Selective Note');

        console.log(`Note visible for Peer A (Princess)? ${hasNoteA ? 'Yes ✓' : 'No ✗'}`);
        console.log(`Note visible for Peer B (Rayhaan)? ${hasNoteB ? 'Yes ✗' : 'No ✓'}`);

        if (!hasNoteA) {
            throw new Error("Note should be visible to Peer A!");
        }
        if (hasNoteB) {
            throw new Error("Note should NOT be visible to Peer B (restricted sharing boundary violation)!");
        }
        console.log("✅ Selective Sharing Boundaries test passed.");


        // ========================================
        // 5. JARVIS Suggestions & Cooldown Test
        // ========================================
        console.log("\n🧪 Test 5: JARVIS Suggestions, Explanations & Cooldowns...");

        // Call suggestions once
        const sug1 = jarvisLayer.getProactiveSuggestions('local_user');
        console.log(`First call suggestions count: ${sug1.length}`);
        if (sug1.length === 0) {
            throw new Error("Suggestions count is 0 on initial call!");
        }

        const suggestion = sug1[0];
        console.log(`Top Suggestion: Text="${suggestion.text}", Type="${suggestion.type}"`);
        console.log(`Explanations attached:`, suggestion.explanation_details);

        if (!suggestion.explanation_details || !suggestion.explanation_details.triggerCondition) {
            throw new Error("Explanations metadata is missing triggerCondition!");
        }

        // Call suggestions a second time immediately - the active type should be in cooldown, returning either a different suggestion or empty list!
        const sug2 = jarvisLayer.getProactiveSuggestions('local_user');
        console.log(`Second call (immediate) suggestions count: ${sug2.length}`);

        if (sug2.length > 0 && sug2[0].type === suggestion.type) {
            throw new Error("Cooldown mechanism failed! Suggestion of the same type was returned immediately without cooldown.");
        }
        console.log("✅ JARVIS Suggestions, Explanations & Cooldowns test passed.");

        console.log("\n🎉 ALL REVISED V1 CONTINUITY ENGINE TESTS PASSED SUCCESSFULLY! 🎉");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ Test Suite Failed:", err.message || err);
        process.exit(1);
    }
}

runTests();
