const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');
const knowledgeRetrieval = require('../main/knowledgeRetrieval');
const assert = require('assert');

async function runTests() {
    console.log("=== Running Phase 2: Notes Engine Tests ===");

    // Clean up
    mainDb.db.prepare("DELETE FROM projects WHERE title = 'Quantum Migration'").run();
    mainDb.db.prepare("DELETE FROM workspace_notes WHERE title = 'Architecture Planning'").run();

    // 1. Setup Mock Goal & Project
    const goalId = mainDb.generateUUID();
    mainDb.db.prepare(`
        INSERT INTO goals (id, user_id, title, status, created_at, updated_at)
        VALUES (?, 'test_user', 'Test Goal', 'active', ?, ?)
    `).run(goalId, Date.now(), Date.now());

    const projId = mainDb.generateUUID();
    mainDb.db.prepare(`
        INSERT INTO projects (id, goal_id, title, status, created_at, updated_at) 
        VALUES (?, ?, 'Quantum Migration', 'active', ?, ?)
    `).run(projId, goalId, Date.now(), Date.now());

    console.log("[Test 1] Create note with blocks and links");
    const content = `
# Migration Strategy
We need to handle the database layer first.

- Review [[Quantum Migration]] timelines
- Allocate resources
    `.trim();

    const resAdd = await notesService.addNote('test_user', 'Architecture Planning', content);
    assert(resAdd.success, "Note creation failed");
    
    // Check blocks
    const blocks = mainDb.db.prepare("SELECT * FROM workspace_blocks WHERE note_id = ?").all(resAdd.noteId);
    assert(blocks.length > 0, "No blocks created");
    console.log(`  ✓ Created ${blocks.length} blocks`);

    // Check links
    const links = mainDb.db.prepare(`
        SELECT * FROM workspace_links 
        WHERE source_id IN (${blocks.map(b=>`'${b.id}'`).join(',')})
    `).all();
    assert(links.length === 1, "Expected 1 link extracted");
    assert(links[0].target_id === projId, "Link target mismatch");
    console.log("  ✓ Link to 'Quantum Migration' successfully extracted");

    console.log("[Test 2] Edit note and capture revision");
    const newContent = content + "\n\n- Update: Migration is blocked.";
    const resEdit = await notesService.editNote('test_user', resAdd.noteId, 'Architecture Planning V2', newContent);
    assert(resEdit.success, "Note edit failed");

    const revisions = await notesService.getNoteRevisions(resAdd.noteId);
    assert(revisions.length === 1, "Expected 1 revision snapshot");
    console.log("  ✓ Revision successfully captured");

    console.log("[Test 3] Knowledge Retrieval includes links");
    const retrieved = knowledgeRetrieval.retrieveExplicitKnowledge('timeline', 5);
    assert(retrieved.length > 0, "Failed to retrieve block");
    assert(retrieved[0].block_content.includes('Context Links: Linked Project: [[Quantum Migration]]'), "Retrieved block missing link context");
    console.log("  ✓ Knowledge retrieval returned block with linked context");

    console.log("=== All Notes Engine Tests Passed! ===");
}

runTests().catch(console.error);
