/**
 * 🧪 PHASE 3 STANDALONE KNOWLEDGE OS SUBSYSTEM TEST SUITE
 * 
 * Verifies that Chrono's Notion + RemNote Hybrid Knowledge Subsystem operates cleanly
 * as a first-class, standalone outliner & database engine with block levels, concept links,
 * spaced repetition flashcards, versioned revisions, and workspace navigation support.
 */

const notesService = require('../main/notesService');
const mainDb = require('../main/main_db');
const assert = require('assert');

async function runPhase3Tests() {
    console.log('==================================================================');
    console.log('📚 CHRONO PHASE 3: STANDALONE KNOWLEDGE SUBSYSTEM TEST SUITE');
    console.log('==================================================================\n');

    let passed = 0;
    let total = 0;

    function check(description, condition) {
        total++;
        if (condition) {
            console.log(`  ✅ [PASS] ${description}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${description}`);
        }
    }

    const testUserId = 'test_user_phase3_' + Date.now();

    // ── TEST 1: Block Parser (12 Types & Outliner Depths) ──────────────────
    console.log('--- TEST 1: Outliner Block Parser & Indent Depths ---');
    const sampleContent = `# Heading 1
## Heading 2
- [ ] Task TODO item
- Bullet item
  - Indented child item
💡 Callout block
🎴 TCP Protocol :: Transport layer protocol providing reliable delivery`;

    const blocks = notesService.parseBlocks(sampleContent);
    check('Parsed 7 structural blocks', blocks.length === 7);
    check('Heading 1 type identified', blocks[0].type === 'h1');
    check('TODO block type identified', blocks[2].type === 'todo');
    check('Indented child depth level calculated', blocks[4].depth_level === 1);
    check('Flashcard block type identified', blocks[6].type === 'flashcard');

    // ── TEST 2: Add Note Page with Icon & Cover ──────────────────────────
    console.log('\n--- TEST 2: Add Standalone Knowledge Page ---');
    const addRes = await notesService.addNote(testUserId, 'Computer Networks', sampleContent, null, '🌐', 'cover.jpg', 1);
    check('Note page created cleanly', addRes.success && addRes.noteId);
    const noteId = addRes.noteId;

    // ── TEST 3: Retrieve Notes & Outliner Hierarchy ─────────────────────
    console.log('\n--- TEST 3: Retrieve Notes & Outliner Hierarchy ---');
    const userNotes = await notesService.getNotes(testUserId);
    check('User notes list returned created note', userNotes.length === 1);
    const fetchedNote = userNotes[0];
    check('Page icon preserved', fetchedNote.icon === '🌐');
    check('Page pin status preserved', fetchedNote.is_pinned === 1);
    check('Note blocks array attached', fetchedNote.blocks && fetchedNote.blocks.length === 7);

    // ── TEST 4: Auto-Extraction of Spaced Repetition Flashcards ─────────
    console.log('\n--- TEST 4: Auto-Extraction of Spaced Repetition Flashcards ---');
    const flashcards = await notesService.getFlashcards(testUserId);
    check('Flashcard deck contains extracted card', flashcards.length >= 1);
    const card = flashcards.find(f => f.front_prompt.includes('TCP Protocol'));
    check('Front prompt matches "TCP Protocol"', card && card.front_prompt === 'TCP Protocol');
    check('Back answer matches "Transport layer protocol..."', card && card.back_answer.includes('Transport layer'));

    // ── TEST 5: Spaced Repetition Review Algorithm ────────────────────────
    console.log('\n--- TEST 5: Spaced Repetition Flashcard Review ---');
    if (card) {
        const reviewRes = await notesService.reviewFlashcard(card.id, 4);
        check('Review score 4 updated flashcard next review date', reviewRes.success && reviewRes.nextReviewAt > Date.now());
    }

    // ── TEST 6: Versioned Revisions & Snapshots ─────────────
    console.log('\n--- TEST 6: Versioned Revision Snapshots ---');
    const editRes = await notesService.editNote(testUserId, noteId, 'Computer Networks Advanced', sampleContent + '\n- [[Operating Systems]] :: Subsystem link', null, '🌐', 'cover.jpg', 1);
    check('Edit note page succeeded', editRes.success);

    const revisions = await notesService.getNoteRevisions(noteId);
    check('Revision snapshot recorded', revisions.length >= 1);
    check('Revision contains user_id and change_type', revisions[0].user_id && revisions[0].change_type === 'edited');

    // ── TEST 7: Revision Restoration ───────────────────────────────────
    console.log('\n--- TEST 7: Revision Restoration ---');
    if (revisions.length > 0) {
        const restoreRes = await notesService.restoreNoteRevision(testUserId, noteId, revisions[0].id);
        check('Revision restoration succeeded', restoreRes.success);
    }

    console.log('\n==================================================================');
    console.log(`🎉 PHASE 3 KNOWLEDGE SUBSYSTEM TEST RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

runPhase3Tests().catch(err => {
    console.error('Phase 3 test failed with error:', err);
    process.exit(1);
});
