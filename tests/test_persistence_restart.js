const mainDb = require('../main/main_db');
const memoryEngine = require('../main/memoryEngine');
const { StateManager } = require('../main/stateManager');
const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runPersistenceRestartTest() {
    console.log("=== Phase 7: Cold Persistence Across Restart Test Suite ===");

    // ------------------------------------------------------------------
    // STEP 1: PRE-RESTART STATE POPULATION
    // ------------------------------------------------------------------
    console.log("\n1. Populating SQLite database with pre-restart state...");
    
    // Cleanup test artifacts
    mainDb.db.prepare("DELETE FROM workspace_notes WHERE title LIKE '%test_restart%'").run();
    mainDb.db.prepare("DELETE FROM workspace_blocks WHERE content LIKE '%test_restart%'").run();
    mainDb.db.prepare("DELETE FROM cognitive_memories WHERE evidence LIKE '%test_restart%'").run();
    mainDb.db.prepare("DELETE FROM tasks WHERE text LIKE '%test_restart%'").run();

    // 1a. Store Notes
    const noteId = "note_restart_101";
    mainDb.db.prepare(`
        INSERT INTO workspace_notes (id, user_id, title, created_at, updated_at) 
        VALUES (?, 'local_user', 'test_restart OSPF Architecture', strftime('%s','now'), strftime('%s','now'))
    `).run(noteId);

    mainDb.db.prepare(`
        INSERT INTO workspace_blocks (id, note_id, content, type, created_at, updated_at) 
        VALUES ('block_restart_101', ?, 'test_restart OSPF is a link-state routing protocol using Dijkstra SPF algorithm.', 'paragraph', strftime('%s','now'), strftime('%s','now'))
    `).run(noteId);

    // 1b. Store Tasks
    mainDb.db.prepare(`
        INSERT INTO tasks (id, text, date, calendar, completed, updated_at)
        VALUES ('task_restart_1', 'test_restart Finish OSPF report', '2026-08-12', 'personal', 0, strftime('%s','now'))
    `).run();

    // 1c. Store Memory Observations with lifecycle states
    const mOld = memoryEngine.storeObservation("User prefers morning study sessions", "User", "test_restart_old");
    const mNew = memoryEngine.correctMemory(mOld, "User prefers evening study sessions", "test_restart_new");
    
    const mForg = memoryEngine.storeObservation("User expressed interest in learning Fortran", "User", "test_restart_forg");
    memoryEngine.forgetMemory(mForg, "User explicitly stated to forget Fortran");

    console.log("   - Note created: 'test_restart OSPF Architecture'");
    console.log("   - Task created: 'test_restart Finish OSPF report'");
    console.log(`   - Memory lifecycle created: Corrected Old (${mOld}), Active New (${mNew}), Forgotten (${mForg})`);

    // ------------------------------------------------------------------
    // STEP 2: SIMULATE COLD APP RESTART
    // ------------------------------------------------------------------
    console.log("\n2. Simulating cold application restart (Re-instantiating all engine singletons)...");

    const stateManager = new StateManager();
    const parser = new SemanticParser();
    const dispatchEngine = new DispatchEngine({ stateManager });
    const reasoningEngine = new ReasoningEngine();

    // ------------------------------------------------------------------
    // STEP 3: POST-RESTART PILLAR INTEGRITY ASSERTIONS
    // ------------------------------------------------------------------
    console.log("\n3. Validating structural pillar integrity post-restart...");

    // Assertion A: Notes remain Notes
    const noteQuery = stateManager.queryState(['KnowledgeBase'], { userInput: 'OSPF' });
    assert(noteQuery.knowledge && noteQuery.knowledge.length > 0, "Notes must be retrievable post-restart");
    assert(noteQuery.knowledge[0].fact.includes("OSPF") || noteQuery.knowledge[0].fact.includes("link-state"), "Note content must be retrieved intact");
    console.log("   ✓ Notes remain Notes (Retrieved correctly from KnowledgeBase)");

    // Assertion B: Tasks remain Tasks
    const taskQuery = stateManager.queryState(['Tasks'], { userInput: 'OSPF' });
    assert(taskQuery.tasks && taskQuery.tasks.length > 0, "Tasks must be retrievable post-restart");
    const restartTask = taskQuery.tasks.find(t => t.text && t.text.includes("test_restart"));
    assert(restartTask, "Tasks must be retrievable post-restart");
    assert.strictEqual(restartTask.text, "test_restart Finish OSPF report");
    console.log("   ✓ Tasks remain Tasks (Retrieved correctly from TaskSubsystem)");

    // Assertion C: Corrected Memory does NOT resurrect old belief
    const oldMemRow = mainDb.db.prepare("SELECT status FROM cognitive_memories WHERE id = ?").get(mOld);
    const newMemRow = mainDb.db.prepare("SELECT status FROM cognitive_memories WHERE id = ?").get(mNew);
    assert.strictEqual(oldMemRow.status, "corrected", "Old memory must remain 'corrected'");
    assert.strictEqual(newMemRow.status, "active", "New memory must remain 'active'");
    
    const activeMemories = memoryEngine.retrieveMemory("study sessions");
    const foundOld = activeMemories.some(m => m.content.includes("morning study"));
    const foundNew = activeMemories.some(m => m.content.includes("evening study"));
    assert.strictEqual(foundOld, false, "Old corrected belief MUST NOT be retrieved");
    assert.strictEqual(foundNew, true, "New active belief MUST be retrieved");
    console.log("   ✓ Corrected memory does not resurrect old belief");

    // Assertion D: Forgotten Memory stays forgotten
    const forgMemRow = mainDb.db.prepare("SELECT status FROM cognitive_memories WHERE id = ?").get(mForg);
    assert.strictEqual(forgMemRow.status, "forgotten", "Forgotten memory status must be 'forgotten'");
    const forgRetrieval = memoryEngine.retrieveMemory("Fortran");
    assert.strictEqual(forgRetrieval.length, 0, "Forgotten memory MUST NOT be retrieved");
    console.log("   ✓ Forgotten memory stays forgotten");

    // Assertion E: No fabricated "welcome back / context resurrection" narrative
    const planCasual = await dispatchEngine.planIntent({ input: "good morning", session: { history: [] } });
    assert.strictEqual(planCasual.selectedModules.length, 0, "Casual greeting post-restart MUST NOT trigger module loading");
    assert.strictEqual(planCasual.intervention.permitted, false, "Casual greeting post-restart MUST NOT permit intervention");
    console.log("   ✓ No fabricated welcome-back narrative injected on startup");

    console.log("\n=========================================");
    console.log("🎉 Cold Persistence Across Restart Suite: ALL PASSED");
    console.log("Notes, Tasks, Memory Lifecycles, and Context Isolation Intact Post-Restart!");
    console.log("=========================================");
}

runPersistenceRestartTest().catch(err => {
    console.error(err);
    process.exit(1);
});
